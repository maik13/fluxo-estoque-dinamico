-- Corrige o PCP das OPs para usar a quantidade exata cadastrada na Etapa,
-- sem proporcionalização pela quantidade planejada da OP.
-- Também corrige snapshots já afetados, desde que ainda não tenham Solicitação de Material vinculada.

BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_ordem_materiais_pcp_fix_audit_20260930 (
  ordem_material_id uuid PRIMARY KEY,
  ordem_producao_id uuid NOT NULL,
  numero_op bigint NOT NULL,
  processo_id uuid NOT NULL,
  item_id uuid NOT NULL,
  quantidade_antes numeric NOT NULL,
  quantidade_pcp numeric NOT NULL,
  solicitacao_material_id uuid NULL,
  status_op text NOT NULL,
  corrigido_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);

ALTER TABLE public.producao_ordem_materiais_pcp_fix_audit_20260930 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producao_ordem_materiais_pcp_fix_audit_20260930 FROM anon, authenticated;

INSERT INTO public.producao_ordem_materiais_pcp_fix_audit_20260930 (
  ordem_material_id,
  ordem_producao_id,
  numero_op,
  processo_id,
  item_id,
  quantidade_antes,
  quantidade_pcp,
  solicitacao_material_id,
  status_op,
  motivo
)
SELECT
  om.id,
  o.id,
  o.numero,
  o.processo_id,
  om.item_id,
  om.quantidade_planejada,
  em.quantidade_planejada,
  om.solicitacao_material_id,
  o.status,
  'Snapshot da OP estava proporcionalizado pela quantidade da OP; restaurado para a quantidade exata do PCP da Etapa.'
FROM public.producao_ordens_producao o
JOIN public.producao_ordem_materiais om
  ON om.ordem_producao_id = o.id
JOIN public.producao_etapa_materiais em
  ON em.id = om.processo_material_id
 AND em.item_id = om.item_id
WHERE om.solicitacao_material_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.solicitacoes_material sm
    WHERE sm.ordem_producao_id = o.id
      AND sm.status <> 'rejeitada'
  )
  AND om.quantidade_planejada IS DISTINCT FROM em.quantidade_planejada
ON CONFLICT (ordem_material_id) DO NOTHING;

UPDATE public.producao_ordem_materiais om
SET quantidade_planejada = em.quantidade_planejada
FROM public.producao_ordens_producao o,
     public.producao_etapa_materiais em
WHERE om.ordem_producao_id = o.id
  AND em.id = om.processo_material_id
  AND em.item_id = om.item_id
  AND om.solicitacao_material_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.solicitacoes_material sm
    WHERE sm.ordem_producao_id = o.id
      AND sm.status <> 'rejeitada'
  )
  AND om.quantidade_planejada IS DISTINCT FROM em.quantidade_planejada;

CREATE OR REPLACE FUNCTION public.sincronizar_materiais_ordem_producao(
  p_ordem_producao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_op public.producao_ordens_producao%ROWTYPE;
BEGIN
  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_op.status NOT IN ('rascunho', 'liberada')
     OR EXISTS (
       SELECT 1
         FROM public.producao_ordem_materiais om
        WHERE om.ordem_producao_id = v_op.id
          AND om.solicitacao_material_id IS NOT NULL
     )
     OR EXISTS (
       SELECT 1
         FROM public.solicitacoes_material sm
        WHERE sm.ordem_producao_id = v_op.id
          AND sm.status <> 'rejeitada'
     ) THEN
    RETURN;
  END IF;

  DELETE FROM public.producao_ordem_materiais
   WHERE ordem_producao_id = v_op.id
     AND solicitacao_material_id IS NULL;

  INSERT INTO public.producao_ordem_materiais (
    ordem_producao_id,
    processo_material_id,
    item_id,
    quantidade_planejada,
    unidade_snapshot,
    item_snapshot,
    observacoes
  )
  SELECT
    v_op.id,
    em.id,
    em.item_id,
    em.quantidade_planejada,
    em.unidade_snapshot,
    em.item_snapshot,
    em.observacoes
  FROM public.producao_etapa_materiais em
  WHERE em.processo_id = v_op.processo_id
  ORDER BY em.created_at, em.id;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_materiais_ordem_producao(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.incorporar_materiais_pcp_op(
  p_ordem_producao_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_total INTEGER := 0;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para incorporar o PCP na Ordem de Produção';
  END IF;

  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'O PCP só pode ser incorporado em uma OP liberada ou em execução';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.solicitacoes_material sm
     WHERE sm.ordem_producao_id = v_op.id
       AND sm.status <> 'rejeitada'
  ) THEN
    RAISE EXCEPTION 'Esta OP já possui uma Solicitação de Material ativa';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.producao_ordem_materiais om
     WHERE om.ordem_producao_id = v_op.id
       AND om.solicitacao_material_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Existem materiais desta OP vinculados a uma solicitação';
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_total
    FROM public.producao_ordem_materiais om
   WHERE om.ordem_producao_id = v_op.id;

  IF v_total > 0 THEN
    RETURN v_total;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.producao_etapa_materiais em
     WHERE em.processo_id = v_op.processo_id
  ) THEN
    RAISE EXCEPTION 'A Etapa não possui materiais no PCP. Salve o planejamento antes de incorporar';
  END IF;

  INSERT INTO public.producao_ordem_materiais (
    ordem_producao_id,
    processo_material_id,
    item_id,
    quantidade_planejada,
    unidade_snapshot,
    item_snapshot,
    observacoes
  )
  SELECT
    v_op.id,
    em.id,
    em.item_id,
    em.quantidade_planejada,
    em.unidade_snapshot,
    em.item_snapshot,
    em.observacoes
  FROM public.producao_etapa_materiais em
  WHERE em.processo_id = v_op.processo_id
  ORDER BY em.created_at, em.id;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Nenhum material pôde ser incorporado à OP';
  END IF;

  v_nome_usuario := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_op.id,
    'pcp_materiais_incorporado',
    v_op.status,
    v_op.status,
    v_user,
    v_nome_usuario,
    'PCP atual da Etapa incorporado à OP sem proporcionalização. Sem solicitação, reserva ou baixa de estoque.',
    JSONB_BUILD_OBJECT(
      'quantidade_itens', v_total,
      'regra_quantidade', 'quantidade_exata_pcp_etapa',
      'gera_solicitacao_material', FALSE,
      'gera_baixa_estoque', FALSE,
      'gera_reserva_estoque', FALSE
    )
  );

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.incorporar_materiais_pcp_op(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incorporar_materiais_pcp_op(UUID) TO authenticated;

COMMENT ON FUNCTION public.incorporar_materiais_pcp_op(UUID) IS
  'Copia o PCP atual da Etapa para a OP usando exatamente as quantidades cadastradas no PCP, sem proporcionalização pela quantidade da OP.';

NOTIFY pgrst, 'reload schema';

COMMIT;
