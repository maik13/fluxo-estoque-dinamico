-- Evita que o plano genérico da função trate o estoque selecionado como um
-- filtro opcional. O caminho mais usado (um estoque, sem histórico legado)
-- passa a usar diretamente o índice por estoque/item/data de criação.
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
BEGIN
  IF p_estoque_id IS NOT NULL AND NOT COALESCE(p_incluir_sem_estoque, false) THEN
    RETURN QUERY
    WITH pagina AS (
      SELECT DISTINCT ON (m.item_id)
        m.id,
        m.item_id
      FROM public.movements m
      WHERE m.estoque_id = p_estoque_id
      ORDER BY m.item_id, m.created_at DESC, m.id DESC
      OFFSET GREATEST(COALESCE(p_inicio, 0), 0)
      LIMIT LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 1000)
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
  ELSE
    RETURN QUERY
    WITH pagina AS (
      SELECT DISTINCT ON (m.item_id)
        m.id,
        m.item_id
      FROM public.movements m
      WHERE p_estoque_id IS NULL
        OR m.estoque_id = p_estoque_id
        OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
      ORDER BY m.item_id, m.created_at DESC, m.id DESC
      OFFSET GREATEST(COALESCE(p_inicio, 0), 0)
      LIMIT LEAST(GREATEST(COALESCE(p_limite, 1000), 1), 1000)
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
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_paginados_v2(uuid, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_paginados_v2(uuid, boolean, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
