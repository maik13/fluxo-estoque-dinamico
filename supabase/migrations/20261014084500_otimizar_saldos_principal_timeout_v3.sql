CREATE OR REPLACE FUNCTION public.listar_saldos_estoque_paginados_v2(
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false,
  p_inicio integer DEFAULT 0,
  p_limite integer DEFAULT 1000
)
RETURNS TABLE (
  item_id uuid,
  saldo_atual numeric,
  ultima_movimentacao jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inicio integer := GREATEST(COALESCE(p_inicio, 0), 0);
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 1000);
  v_tem_legado_sem_estoque boolean := false;
BEGIN
  -- Caminho mais comum: estoque selecionado sem legado.
  IF p_estoque_id IS NOT NULL AND NOT COALESCE(p_incluir_sem_estoque, false) THEN
    RETURN QUERY
    WITH pagina AS (
      SELECT DISTINCT ON (m.item_id)
        m.id,
        m.item_id
      FROM public.movements m
      WHERE m.estoque_id = p_estoque_id
      ORDER BY m.item_id, m.created_at DESC, m.id DESC
      OFFSET v_inicio
      LIMIT v_limite
    )
    SELECT
      m.item_id,
      m.quantidade_atual::numeric,
      jsonb_build_object(
        'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
        'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
        'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
        'observacoes', m.observacoes, 'dataHora', m.data_hora,
        'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
        'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
        'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
      )
    FROM pagina p
    JOIN public.movements m ON m.id = p.id
    ORDER BY p.item_id;
    RETURN;
  END IF;

  -- O Estoque Principal inclui movimentos legados sem estoque_id.
  -- Quando não há legado (situação atual), evita o OR genérico e usa diretamente
  -- o índice específico por estoque/item/data.
  IF p_estoque_id IS NOT NULL AND COALESCE(p_incluir_sem_estoque, false) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.movements m
      WHERE m.estoque_id IS NULL
      LIMIT 1
    )
    INTO v_tem_legado_sem_estoque;

    IF NOT v_tem_legado_sem_estoque THEN
      RETURN QUERY
      WITH pagina AS (
        SELECT DISTINCT ON (m.item_id)
          m.id,
          m.item_id
        FROM public.movements m
        WHERE m.estoque_id = p_estoque_id
        ORDER BY m.item_id, m.created_at DESC, m.id DESC
        OFFSET v_inicio
        LIMIT v_limite
      )
      SELECT
        m.item_id,
        m.quantidade_atual::numeric,
        jsonb_build_object(
          'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
          'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
          'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
          'observacoes', m.observacoes, 'dataHora', m.data_hora,
          'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
          'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
          'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
        )
      FROM pagina p
      JOIN public.movements m ON m.id = p.id
      ORDER BY p.item_id;
      RETURN;
    END IF;

    RETURN QUERY
    WITH candidatos AS (
      SELECT m.id, m.item_id, m.created_at
      FROM public.movements m
      WHERE m.estoque_id = p_estoque_id

      UNION ALL

      SELECT m.id, m.item_id, m.created_at
      FROM public.movements m
      WHERE m.estoque_id IS NULL
    ),
    pagina AS (
      SELECT DISTINCT ON (c.item_id)
        c.id,
        c.item_id
      FROM candidatos c
      ORDER BY c.item_id, c.created_at DESC, c.id DESC
      OFFSET v_inicio
      LIMIT v_limite
    )
    SELECT
      m.item_id,
      m.quantidade_atual::numeric,
      jsonb_build_object(
        'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
        'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
        'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
        'observacoes', m.observacoes, 'dataHora', m.data_hora,
        'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
        'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
        'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
      )
    FROM pagina p
    JOIN public.movements m ON m.id = p.id
    ORDER BY p.item_id;
    RETURN;
  END IF;

  -- Compatibilidade para chamadas sem estoque definido.
  RETURN QUERY
  WITH pagina AS (
    SELECT DISTINCT ON (m.item_id)
      m.id,
      m.item_id
    FROM public.movements m
    ORDER BY m.item_id, m.created_at DESC, m.id DESC
    OFFSET v_inicio
    LIMIT v_limite
  )
  SELECT
    m.item_id,
    m.quantidade_atual::numeric,
    jsonb_build_object(
      'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
      'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
      'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
      'observacoes', m.observacoes, 'dataHora', m.data_hora,
      'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
      'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
      'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
    )
  FROM pagina p
  JOIN public.movements m ON m.id = p.id
  ORDER BY p.item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_paginados_v2(uuid, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_paginados_v2(uuid, boolean, integer, integer) TO authenticated;

ANALYZE public.movements;
NOTIFY pgrst, 'reload schema';