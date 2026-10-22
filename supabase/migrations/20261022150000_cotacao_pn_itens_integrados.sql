BEGIN;
-- Uma PN deve herdar integralmente os itens da cotacao de origem.
-- O gatilho funciona para a conversao feita pela Central e por qualquer
-- cliente que execute cotacao_converter_em_pn_v1.
CREATE OR REPLACE FUNCTION public.cotacao_preencher_itens_pn_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_ordem integer := 0;
 v_item record;
BEGIN
 IF NEW.financeiro_necessidade_id IS NULL
    OR NEW.financeiro_necessidade_id IS NOT DISTINCT FROM OLD.financeiro_necessidade_id THEN
   RETURN NEW;
 END IF;
 IF EXISTS (SELECT 1 FROM public.financeiro_necessidade_itens WHERE necessidade_id=NEW.financeiro_necessidade_id) THEN
   RETURN NEW;
 END IF;
 FOR v_item IN
   SELECT ci.item_id,ci.descricao,ci.especificacao,ci.quantidade,ci.unidade,
          ci.valor_unitario,ci.valor_total,ci.ordem,ci.codigo_item,ci.marca
   FROM public.cotacao_itens ci WHERE ci.cotacao_id=NEW.id
   ORDER BY ci.ordem,ci.id
 LOOP
   v_ordem := v_ordem+1;
   INSERT INTO public.financeiro_necessidade_itens(
     necessidade_id,item_id,origem,descricao,especificacao,quantidade,unidade,
     valor_unitario_estimado,valor_total_estimado,item_snapshot,ordem)
   VALUES(
     NEW.financeiro_necessidade_id,v_item.item_id,
     CASE WHEN v_item.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
     coalesce(nullif(btrim(v_item.descricao),''),'Item de cotacao'),
     v_item.especificacao,coalesce(v_item.quantidade,1),coalesce(nullif(v_item.unidade,''),'UN'),
     v_item.valor_unitario,v_item.valor_total,
     jsonb_build_object('cotacao_id',NEW.id,'codigo_item',v_item.codigo_item,'marca',v_item.marca),v_ordem);
 END LOOP;
 -- Algumas cotacoes possuem itens somente na solicitacao inicial.
 IF v_ordem=0 AND NEW.solicitacao_id IS NOT NULL THEN
   INSERT INTO public.financeiro_necessidade_itens(
     necessidade_id,item_id,origem,descricao,quantidade,unidade,item_snapshot,ordem)
   SELECT NEW.financeiro_necessidade_id,s.item_id,
     CASE WHEN s.item_id IS NULL THEN 'avulso' ELSE 'estoque' END,
     coalesce(nullif(btrim(s.descricao),''),'Item solicitado'),
     coalesce(s.quantidade,1),coalesce(nullif(s.unidade,''),'UN'),
     jsonb_build_object('cotacao_id',NEW.id,'solicitacao_id',NEW.solicitacao_id,'codigo_item',s.codigo_item,'observacoes',s.observacoes),
     row_number() OVER (ORDER BY s.ordem,s.id)::integer
   FROM public.cotacao_solicitacao_itens s WHERE s.solicitacao_id=NEW.solicitacao_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_cotacao_preencher_itens_pn_v1 ON public.cotacoes;
CREATE TRIGGER trg_cotacao_preencher_itens_pn_v1
AFTER UPDATE OF financeiro_necessidade_id ON public.cotacoes
FOR EACH ROW EXECUTE FUNCTION public.cotacao_preencher_itens_pn_v1();
COMMIT;