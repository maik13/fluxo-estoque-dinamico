BEGIN;

CREATE OR REPLACE FUNCTION public.listar_posicoes_estoque_exportacao_v1(
  p_estoque_id UUID,
  p_incluir_sem_estoque BOOLEAN DEFAULT FALSE,
  p_item_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE(
  item_id UUID,
  saldo_atual NUMERIC,
  ultima_movimentacao JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH itens_solicitados AS (
    SELECT DISTINCT i.id
    FROM public.items i
    WHERE auth.uid() IS NOT NULL
      AND i.id = ANY(COALESCE(p_item_ids, ARRAY[]::UUID[]))
  ),
  ultima AS (
    SELECT
      i.id AS item_id,
      m.quantidade_atual::NUMERIC AS saldo_atual,
      CASE
        WHEN m.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', m.id,
          'itemId', m.item_id,
          'tipo', m.tipo,
          'quantidade', m.quantidade,
          'quantidadeAnterior', m.quantidade_anterior,
          'quantidadeAtual', m.quantidade_atual,
          'userId', m.user_id,
          'observacoes', m.observacoes,
          'dataHora', m.data_hora,
          'localUtilizacaoId', m.local_utilizacao_id,
          'solicitacaoId', m.solicitacao_id,
          'destinatario', m.destinatario,
          'estoqueId', m.estoque_id,
          'tipoOperacaoId', m.tipo_operacao_id,
          'itemSnapshot', m.item_snapshot
        )
      END AS ultima_movimentacao
    FROM itens_solicitados i
    LEFT JOIN LATERAL (
      SELECT m.*
      FROM public.movements m
      WHERE m.item_id = i.id
        AND (
          m.estoque_id = p_estoque_id
          OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
        )
      ORDER BY m.data_hora DESC, m.id DESC
      LIMIT 1
    ) m ON TRUE
  )
  SELECT
    u.item_id,
    COALESCE(u.saldo_atual, 0)::NUMERIC AS saldo_atual,
    u.ultima_movimentacao
  FROM ultima u
  ORDER BY u.item_id;
$$;

REVOKE ALL ON FUNCTION public.listar_posicoes_estoque_exportacao_v1(UUID, BOOLEAN, UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_posicoes_estoque_exportacao_v1(UUID, BOOLEAN, UUID[])
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
