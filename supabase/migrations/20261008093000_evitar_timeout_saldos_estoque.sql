-- A tela inicial consulta a última posição de cada item. A versão anterior
-- reunia os cenários de estoque em uma cláusula OR, o que podia impedir o uso
-- do índice de Almoxarifado e causar timeout ao confirmar os saldos.
CREATE INDEX IF NOT EXISTS idx_movements_item_created_ultima
  ON public.movements (item_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_movements_sem_estoque_item_created_ultima
  ON public.movements (item_id, created_at DESC, id DESC)
  WHERE estoque_id IS NULL;

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
WITH candidatas AS (
  -- Estoque selecionado: usa idx_movements_estoque_item_created_ultima.
  SELECT m.id, m.item_id, m.created_at
  FROM public.movements m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND p_estoque_id IS NOT NULL
    AND m.estoque_id = p_estoque_id

  UNION ALL

  -- Sem filtro de estoque: usa idx_movements_item_created_ultima.
  SELECT m.id, m.item_id, m.created_at
  FROM public.movements m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND p_estoque_id IS NULL

  UNION ALL

  -- Itens antigos sem estoque só entram quando a tela os solicita.
  SELECT m.id, m.item_id, m.created_at
  FROM public.movements m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND p_estoque_id IS NOT NULL
    AND p_incluir_sem_estoque
    AND m.estoque_id IS NULL
),
ultima_ids AS (
  SELECT DISTINCT ON (item_id) id, item_id
  FROM candidatas
  ORDER BY item_id, created_at DESC, id DESC
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
