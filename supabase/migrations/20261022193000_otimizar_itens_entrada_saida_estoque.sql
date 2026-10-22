-- A seleção de itens da Entrada/Retirada não deve varrer e ordenar todo o
-- histórico de movimentos. Pagina primeiro o catálogo e faz uma busca
-- indexada da última posição de cada item.
CREATE OR REPLACE FUNCTION public.listar_saldos_estoque_paginados_v3(
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false,
  p_inicio integer DEFAULT 0,
  p_limite integer DEFAULT 500
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
  v_tem_legado boolean := false;
BEGIN
  IF p_estoque_id IS NOT NULL THEN
    IF COALESCE(p_incluir_sem_estoque, false) THEN
      SELECT EXISTS (SELECT 1 FROM public.movements WHERE estoque_id IS NULL LIMIT 1)
      INTO v_tem_legado;
    END IF;

    IF NOT v_tem_legado THEN
      RETURN QUERY
      WITH pagina_itens AS (
        SELECT i.id FROM public.items i ORDER BY i.id
        OFFSET GREATEST(COALESCE(p_inicio, 0), 0)
        LIMIT LEAST(GREATEST(COALESCE(p_limite, 500), 1), 500)
      )
      SELECT i.id, COALESCE(m.quantidade_atual, 0)::numeric,
        CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
          'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
          'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
          'observacoes', m.observacoes, 'dataHora', m.data_hora,
          'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
          'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
          'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
        ) END
      FROM pagina_itens i
      LEFT JOIN LATERAL (
        SELECT mov.* FROM public.movements mov
        WHERE mov.item_id = i.id AND mov.estoque_id = p_estoque_id
        ORDER BY mov.created_at DESC, mov.id DESC LIMIT 1
      ) m ON true ORDER BY i.id;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH pagina_itens AS (
    SELECT i.id
    FROM public.items i
    ORDER BY i.id
    OFFSET GREATEST(COALESCE(p_inicio, 0), 0)
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 500), 1), 500)
  )
  SELECT
    i.id AS item_id,
    COALESCE(m.quantidade_atual, 0)::numeric AS saldo_atual,
    CASE WHEN m.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', m.id, 'itemId', m.item_id, 'tipo', m.tipo,
      'quantidade', m.quantidade, 'quantidadeAnterior', m.quantidade_anterior,
      'quantidadeAtual', m.quantidade_atual, 'userId', m.user_id,
      'observacoes', m.observacoes, 'dataHora', m.data_hora,
      'localUtilizacaoId', m.local_utilizacao_id, 'solicitacaoId', m.solicitacao_id,
      'destinatario', m.destinatario, 'estoqueId', m.estoque_id,
      'tipoOperacaoId', m.tipo_operacao_id, 'itemSnapshot', m.item_snapshot
    ) END AS ultima_movimentacao
  FROM pagina_itens i
  LEFT JOIN LATERAL (
    SELECT mov.*
    FROM public.movements mov
    WHERE mov.item_id = i.id
      AND (
        p_estoque_id IS NULL
        OR mov.estoque_id = p_estoque_id
        OR (COALESCE(p_incluir_sem_estoque, false) AND mov.estoque_id IS NULL)
      )
    ORDER BY mov.created_at DESC, mov.id DESC
    LIMIT 1
  ) m ON true
  ORDER BY i.id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_paginados_v3(uuid, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_paginados_v3(uuid, boolean, integer, integer) TO authenticated;

-- Consulta curta usada imediatamente antes de uma saída. A trigger continua
-- sendo a autoridade final, mas a interface deixa de decidir com saldo antigo.
CREATE OR REPLACE FUNCTION public.obter_saldo_item_estoque_v1(
  p_item_id uuid,
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT m.quantidade_atual
    FROM public.movements m
    WHERE m.item_id = p_item_id
      AND (
        p_estoque_id IS NULL
        OR m.estoque_id = p_estoque_id
        OR (COALESCE(p_incluir_sem_estoque, false) AND m.estoque_id IS NULL)
      )
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ), 0)::numeric;
$$;

REVOKE ALL ON FUNCTION public.obter_saldo_item_estoque_v1(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_saldo_item_estoque_v1(uuid, uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
