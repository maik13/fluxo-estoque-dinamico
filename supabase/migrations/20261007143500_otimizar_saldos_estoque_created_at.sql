-- A função de saldos usa created_at para determinar a última movimentação.
-- Este índice atende exatamente ao filtro e à ordenação da consulta.
CREATE INDEX IF NOT EXISTS idx_movements_estoque_item_created_ultima
  ON public.movements (estoque_id, item_id, created_at DESC, id DESC)
  WHERE estoque_id IS NOT NULL;

-- Primeiro encontra somente o identificador da última movimentação de cada
-- item. Em seguida, lê os campos completos apenas dessas linhas, evitando
-- carregar milhares de snapshots que serão descartados pelo DISTINCT ON.
CREATE OR REPLACE FUNCTION public.listar_saldos_estoque_v1(
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false
)
RETURNS TABLE (
  item_id uuid,
  saldo_atual numeric,
  ultima_movimentacao jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH ultima_ids AS (
  SELECT DISTINCT ON (m.item_id)
    m.id,
    m.item_id
  FROM public.movements m
  WHERE auth.uid() IS NOT NULL
    AND (
      p_estoque_id IS NULL
      OR m.estoque_id = p_estoque_id
      OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
    )
  ORDER BY m.item_id, m.created_at DESC, m.id DESC
)
SELECT
  m.item_id,
  m.quantidade_atual::numeric AS saldo_atual,
  jsonb_build_object(
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
  ) AS ultima_movimentacao
FROM ultima_ids u
JOIN public.movements m ON m.id = u.id;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) TO authenticated;

ANALYZE public.movements;
NOTIFY pgrst, 'reload schema';
