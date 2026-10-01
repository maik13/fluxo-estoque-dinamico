CREATE OR REPLACE FUNCTION public.registrar_devolucao_lote_v1(p_requisicao_id uuid,p_dados jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_user uuid:=auth.uid(); v_s public.solicitacoes%ROWTYPE;
 v_item public.items%ROWTYPE; v_local uuid; v_estoque uuid; v_tipo uuid;
 v_itens jsonb; r jsonb; v_qtd numeric; v_snapshot jsonb; v_nome_local text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
 IF p_requisicao_id IS NULL THEN RAISE EXCEPTION 'Identificador da devolução obrigatório'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_requisicao_id::text,0));
 SELECT * INTO v_s FROM public.solicitacoes WHERE id=p_requisicao_id;
 IF FOUND THEN
   IF v_s.criado_por_id IS DISTINCT FROM v_user OR v_s.tipo_operacao NOT IN ('devolucao','devolucao_estoque') THEN
     RAISE EXCEPTION 'Identificador de devolução inválido';
   END IF;
   RETURN jsonb_build_object('id',v_s.id,'numero',v_s.numero,'jaRegistrada',true);
 END IF;
 v_itens:=p_dados->'itens';
 IF jsonb_typeof(v_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(v_itens)=0 THEN
   RAISE EXCEPTION 'Informe os itens para devolução';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_itens) x GROUP BY x->>'item_id' HAVING count(*)>1) THEN
   RAISE EXCEPTION 'Há itens repetidos na devolução';
 END IF;
 v_local:=(p_dados->>'local_utilizacao_id')::uuid;
 v_estoque:=(p_dados->>'estoque_id')::uuid;
 v_tipo:=(p_dados->>'tipo_operacao_id')::uuid;
 SELECT nome INTO v_nome_local FROM public.locais_utilizacao WHERE id=v_local AND ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Local de origem inexistente ou inativo'; END IF;
 IF v_estoque IS NULL OR NOT EXISTS(SELECT 1 FROM public.estoques WHERE id=v_estoque AND ativo) THEN
   RAISE EXCEPTION 'Selecione um almoxarifado ativo';
 END IF;
 IF v_tipo IS NULL OR NOT EXISTS(SELECT 1 FROM public.tipos_operacao WHERE id=v_tipo AND tipo='entrada' AND ativo) THEN
   RAISE EXCEPTION 'Tipo de operação de devolução inválido';
 END IF;
 -- Os locks seguem a mesma ordem para evitar disputa entre lotes.
 PERFORM i.id FROM public.items i
 WHERE i.id IN (SELECT (x->>'item_id')::uuid FROM jsonb_array_elements(v_itens) x)
 ORDER BY i.id FOR UPDATE;
 INSERT INTO public.solicitacoes(id,solicitante_id,solicitante_nome,observacoes,
 local_utilizacao_id,local_utilizacao,responsavel_estoque,tipo_operacao,tipo_operacao_id,
 solicitacao_origem_id,criado_por_id,estoque_id)
 VALUES(p_requisicao_id,(p_dados->>'solicitante_id')::uuid,p_dados->>'solicitante_nome',
 p_dados->>'observacoes',v_local,v_nome_local,p_dados->>'responsavel_estoque',
 'devolucao',v_tipo,(p_dados->>'solicitacao_origem_id')::uuid,v_user,v_estoque)
 RETURNING * INTO v_s;
 FOR r IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
   SELECT * INTO v_item FROM public.items WHERE id=(r->>'item_id')::uuid AND coalesce(ativo,true);
   IF NOT FOUND THEN RAISE EXCEPTION 'Item inexistente ou inativo: %',r->>'item_id'; END IF;
   v_qtd:=(r->>'quantidade_solicitada')::numeric;
   IF v_qtd IS NULL OR v_qtd<=0 OR v_qtd::text IN ('NaN','Infinity','-Infinity') THEN
     RAISE EXCEPTION 'Quantidade inválida para %',v_item.nome;
   END IF;
   v_snapshot:=coalesce(r->'item_snapshot','{}'::jsonb) ||
     jsonb_build_object('id',v_item.id,'nome',v_item.nome,'codigoBarras',v_item.codigo_barras);
   INSERT INTO public.solicitacao_itens(solicitacao_id,item_id,quantidade_solicitada,quantidade_aprovada,item_snapshot)
   VALUES(v_s.id,v_item.id,v_qtd,v_qtd,v_snapshot);
   BEGIN
     INSERT INTO public.movements(item_id,tipo,quantidade,quantidade_anterior,quantidade_atual,
       user_id,observacoes,local_utilizacao_id,item_snapshot,solicitacao_id,estoque_id,tipo_operacao_id)
     VALUES(v_item.id,'ENTRADA',v_qtd,0,0,v_user,
       'Devolução - Solicitação #'||v_s.numero||coalesce(' - '||nullif(p_dados->>'observacoes',''),''),
       v_local,v_snapshot,v_s.id,v_estoque,v_tipo);
   EXCEPTION WHEN OTHERS THEN
     RAISE EXCEPTION 'Devolução não registrada. Item % (%): %',v_item.codigo_barras,v_item.nome,SQLERRM;
   END;
 END LOOP;
 RETURN jsonb_build_object('id',v_s.id,'numero',v_s.numero,'jaRegistrada',false);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_devolucao_lote_v1(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_devolucao_lote_v1(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
