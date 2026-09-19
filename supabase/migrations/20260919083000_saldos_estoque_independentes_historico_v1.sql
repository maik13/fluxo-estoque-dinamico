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
WITH movimentos AS (
  SELECT
    m.*,
    (
      m.tipo = 'ENTRADA'
      AND lower(COALESCE(t.nome, '')) LIKE '%acerto%'
    ) AS eh_acerto
  FROM public.movements m
  LEFT JOIN public.tipos_operacao t ON t.id = m.tipo_operacao_id
  WHERE auth.uid() IS NOT NULL
    AND (
      p_estoque_id IS NULL
      OR m.estoque_id = p_estoque_id
      OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
    )
),
ultimo_acerto AS (
  SELECT DISTINCT ON (item_id)
    item_id,
    id,
    data_hora,
    quantidade_atual
  FROM movimentos
  WHERE eh_acerto
  ORDER BY item_id, data_hora DESC, id DESC
),
saldos AS (
  SELECT
    m.item_id,
    (
      COALESCE(ua.quantidade_atual, 0)
      + COALESCE(SUM(
          CASE
            WHEN ua.item_id IS NULL
              OR (m.data_hora, m.id) > (ua.data_hora, ua.id)
            THEN CASE
              WHEN m.tipo = 'ENTRADA' THEN COALESCE(m.quantidade, 0)
              WHEN m.tipo = 'SAIDA' THEN -COALESCE(m.quantidade, 0)
              ELSE 0
            END
            ELSE 0
          END
        ), 0)
    )::numeric AS saldo_atual
  FROM movimentos m
  LEFT JOIN ultimo_acerto ua ON ua.item_id = m.item_id
  GROUP BY m.item_id, ua.item_id, ua.quantidade_atual, ua.data_hora, ua.id
),
ultima AS (
  SELECT DISTINCT ON (m.item_id)
    m.item_id,
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
  FROM movimentos m
  ORDER BY m.item_id, m.data_hora DESC, m.id DESC
)
SELECT
  s.item_id,
  s.saldo_atual,
  u.ultima_movimentacao
FROM saldos s
LEFT JOIN ultima u ON u.item_id = s.item_id;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
