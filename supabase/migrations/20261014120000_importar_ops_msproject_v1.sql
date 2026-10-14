-- Preparação não publicada: operação transacional de importação de OPs do MS Project.
-- Apenas uma sessão autenticada com permissão 'processos' poderá executá-la.
-- Não criar etapa/projeto/tarefa automaticamente nem alterar APs existentes.
CREATE OR REPLACE FUNCTION public.importar_ops_msproject_v1(p_atividades jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_projeto public.producao_projetos%ROWTYPE;
  v_etapa public.producao_processos%ROWTYPE;
  v_tarefa public.producao_tarefas%ROWTYPE;
  v_existente public.producao_ordens_producao%ROWTYPE;
  v_nova uuid;
  v_chave text;
  v_criadas int := 0;
  v_mantidas int := 0;
  v_edts text[] := ARRAY[]::text[];
  v_ini date;
  v_fim date;
  v_qtd numeric;
  v_horas numeric;
  v_equipe int;
  v_local text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Permissão de Produção necessária para importar OPs';
  END IF;
  IF jsonb_typeof(p_atividades) <> 'array'
     OR jsonb_array_length(p_atividades) = 0
     OR jsonb_array_length(p_atividades) > 200 THEN
    RAISE EXCEPTION 'Lote inválido: use de 1 a 200 atividades';
  END IF;

  -- Validação e inserção são atômicas: qualquer falha reverte o lote inteiro.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_atividades)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Atividade em formato inválido';
    END IF;
    IF COALESCE(v_item->>'edt','') = ''
      OR COALESCE(v_item->>'codigo_peca','') = ''
      OR COALESCE(v_item->>'nome_atividade','') = '' THEN
      RAISE EXCEPTION 'EDT, código da peça e nome da atividade obrigatórios';
    END IF;
    v_chave := 'MSP-v24 | EDT ' || (v_item->>'edt') || ' | ' || (v_item->>'codigo_peca');
    IF v_chave = ANY(v_edts) THEN
      RAISE EXCEPTION 'EDT duplicado no lote: %',v_chave;
    END IF;
    v_edts := array_append(v_edts,v_chave);

    SELECT * INTO STRICT v_projeto
      FROM public.producao_projetos
      WHERE id=(v_item->>'projeto_id')::uuid
        AND btrim(nome)=btrim(v_item->>'nome_completo_sistema');

    SELECT * INTO STRICT v_etapa
      FROM public.producao_processos
      WHERE id=(v_item->>'etapa_id')::uuid
        AND projeto_id=v_projeto.id
        AND nome=('Etapa '||(v_item->>'etapa'));

    IF v_etapa.status IN ('finalizado','cancelado') THEN
      RAISE EXCEPTION 'Etapa encerrada: %',v_etapa.id;
    END IF;

    SELECT * INTO STRICT v_tarefa
      FROM public.producao_tarefas
      WHERE id=(v_item->>'tarefa_id')::uuid
        AND ativo=true
        AND lower(btrim(nome))=lower(btrim(v_item->>'nome_atividade'));

    v_ini := (v_item->>'inicio')::date;
    v_fim := (v_item->>'termino')::date;
    v_qtd := (v_item->>'quantidade_planejada')::numeric;
    v_horas := (v_item->>'duracao_horas')::numeric;
    v_equipe := (v_item->>'equipe_prevista')::int;
    v_local := v_item->>'local_tipo';
    IF v_ini IS NULL OR v_fim IS NULL OR v_fim<v_ini
        OR v_qtd<=0 OR v_horas<=0 OR v_equipe<=0
        OR v_local NOT IN ('Fábrica','Execução') THEN
      RAISE EXCEPTION 'Prazo, quantidade, duração, equipe ou local inválidos em %',v_chave;
    END IF;

    SELECT * INTO v_existente
    FROM public.producao_ordens_producao
    WHERE projeto_id=v_projeto.id
      AND split_part(coalesce(instrucoes,''),' | ',3)=(v_item->>'codigo_peca')
      AND split_part(coalesce(instrucoes,''),' | ',2)='EDT '||(v_item->>'edt')
      AND split_part(coalesce(instrucoes,''),' | ',1)='MSP-v24'
    FOR UPDATE;
    IF FOUND THEN
      IF v_existente.processo_id<>v_etapa.id THEN
        RAISE EXCEPTION 'EDT existente vinculado a outra etapa: %',v_chave;
      END IF;
      v_mantidas := v_mantidas+1;
      CONTINUE;
    END IF;

    -- Não duplicar OPs anteriores com a mesma tarefa mesmo em outra etapa.
    IF EXISTS (
      SELECT 1 FROM public.producao_ordens_producao o
      WHERE o.projeto_id=v_projeto.id AND o.status<>'cancelada'
      AND (o.tarefa_id=v_tarefa.id
           OR lower(btrim(coalesce(o.tarefa_nome_snapshot,'')))=lower(btrim(v_tarefa.nome)))
    ) THEN
      RAISE EXCEPTION 'OP de mesmo nome/tarefa já existe; conciliar execução: %',v_chave;
    END IF;

    INSERT INTO public.producao_ordens_producao (
      processo_id,projeto_id,tarefa_id,tarefa_nome_snapshot,local_tipo,
      descricao,instrucoes,produto_entregavel,unidade_medida,quantidade_planejada,
      duracao_estimada_horas,equipe_prevista,data_inicio_prevista,data_fim_prevista,
      status,prioridade,criado_por_id
    ) VALUES (
      v_etapa.id,v_projeto.id,v_tarefa.id,v_tarefa.nome,v_local,
      v_item->>'nome_atividade',v_chave||' | '||(v_item->>'nome_atividade'),
      v_etapa.produto_entregavel,v_etapa.unidade_medida,v_qtd,
      v_horas,v_equipe,v_ini,v_fim,'liberada','normal',auth.uid()
    ) RETURNING id INTO v_nova;
    INSERT INTO public.producao_ordem_eventos(
      ordem_producao_id,evento,novo_status,usuario_id,dados
    ) VALUES (
      v_nova,'op_emitida','liberada',auth.uid(),
      jsonb_build_object('fonte','MSP-v24','edt',v_item->>'edt',
        'codigo_peca',v_item->>'codigo_peca','inicio',v_ini,'fim',v_fim)
    );
    v_criadas := v_criadas+1;
  END LOOP;
  RETURN jsonb_build_object('criadas',v_criadas,'mantidas',v_mantidas);
END;
$$;
REVOKE ALL ON FUNCTION public.importar_ops_msproject_v1(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.importar_ops_msproject_v1(jsonb) TO authenticated;
