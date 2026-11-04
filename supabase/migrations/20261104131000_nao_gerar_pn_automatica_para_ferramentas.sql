-- Ferramenta fora do almoxarifado está em uso; não representa necessidade de compra.
-- Esta migration só altera a decisão para novas aprovações. Não toca PNs, RCs,
-- lançamentos financeiros ou solicitações já existentes.
DO $$
DECLARE
  v_definicao text;
  v_trecho_antigo constant text :=
    'IF v_solicitacao.estoque_id IS NULL OR v_saldo < v_item.quantidade THEN';
  v_trecho_novo constant text :=
    'IF NOT EXISTS (
          SELECT 1
            FROM public.items item_ferramenta
            JOIN public.categorias categoria_ferramenta
              ON categoria_ferramenta.id = item_ferramenta.categoria_id
           WHERE item_ferramenta.id = v_item.item_id
             AND lower(trim(coalesce(categoria_ferramenta.nome, ''''))) = ''ferramenta''
        ) AND (v_solicitacao.estoque_id IS NULL OR v_saldo < v_item.quantidade) THEN';
BEGIN
  SELECT pg_get_functiondef('public.aprovar_solicitacao_material_v2(uuid)'::regprocedure)
    INTO v_definicao;

  IF position(v_trecho_antigo IN v_definicao) = 0 THEN
    RAISE EXCEPTION 'Não foi possível aplicar a proteção de ferramentas: regra de aprovação esperada não encontrada.';
  END IF;

  EXECUTE replace(v_definicao, v_trecho_antigo, v_trecho_novo);
END;
$$;

COMMENT ON FUNCTION public.aprovar_solicitacao_material_v2(uuid) IS
  'Aprova e classifica itens no servidor. Ferramentas são mantidas para avaliação e retirada, sem PN automática por indisponibilidade.';

NOTIFY pgrst, 'reload schema';
