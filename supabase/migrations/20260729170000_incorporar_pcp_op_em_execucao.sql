-- Permite incorporar manualmente o PCP atual da Etapa em uma OP já liberada
-- ou em execução, desde que a OP ainda não possua materiais nem solicitação ativa.

BEGIN;

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
  v_quantidade_etapa NUMERIC;
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

  -- A operação é idempotente: se a OP já recebeu materiais sem solicitação,
  -- apenas retorna a quantidade existente e não duplica os registros.
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

  SELECT p.quantidade_planejada
    INTO v_quantidade_etapa
    FROM public.producao_processos p
   WHERE p.id = v_op.processo_id;

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
    CASE
      WHEN COALESCE(v_quantidade_etapa, 0) > 0 THEN
        GREATEST(
          ROUND(
            em.quantidade_planejada * v_op.quantidade_planejada / v_quantidade_etapa,
            4
          ),
          0.0001
        )
      ELSE em.quantidade_planejada
    END,
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
    'PCP atual da Etapa incorporado manualmente à OP. Sem solicitação, reserva ou baixa de estoque.',
    JSONB_BUILD_OBJECT(
      'quantidade_itens', v_total,
      'gera_solicitacao_material', FALSE,
      'gera_baixa_estoque', FALSE,
      'gera_reserva_estoque', FALSE
    )
  );

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.incorporar_materiais_pcp_op(UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incorporar_materiais_pcp_op(UUID)
  TO authenticated;

COMMENT ON FUNCTION public.incorporar_materiais_pcp_op(UUID) IS
  'Copia proporcionalmente o PCP atual da Etapa para uma OP liberada ou em execução ainda sem materiais e sem solicitação ativa.';

NOTIFY pgrst, 'reload schema';

COMMIT;
