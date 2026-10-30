-- A versão anterior reunia o estoque selecionado e os registros legados em
-- uma condição OR dentro de uma busca lateral executada para cada item. No
-- almoxarifado principal isso podia impedir o uso dos índices e atingir o
-- statement_timeout. Cada origem agora é consultada separadamente e somente
-- as duas últimas posições indexadas são comparadas.
CREATE INDEX IF NOT EXISTS idx_movements_estoque_item_created_ultima
  ON public.movements (estoque_id, item_id, created_at DESC, id DESC)
  WHERE estoque_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movements_sem_estoque_item_created_ultima
  ON public.movements (item_id, created_at DESC, id DESC)
  WHERE estoque_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_movements_item_created_ultima
  ON public.movements (item_id, created_at DESC, id DESC);

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
BEGIN
  RETURN QUERY
  WITH pagina_itens AS (
    SELECT i.id
    FROM public.items i
    ORDER BY i.id
    OFFSET GREATEST(COALESCE(p_inicio, 0), 0)
    LIMIT LEAST(GREATEST(COALESCE(p_limite, 500), 1), 500)
  )
  SELECT
    i.id,
    COALESCE(m.quantidade_atual, 0)::numeric,
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
    SELECT candidato.*
    FROM (
      (
        SELECT mov.*
        FROM public.movements mov
        WHERE mov.item_id = i.id
          AND p_estoque_id IS NOT NULL
          AND mov.estoque_id = p_estoque_id
        ORDER BY mov.created_at DESC, mov.id DESC
        LIMIT 1
      )
      UNION ALL
      (
        SELECT mov.*
        FROM public.movements mov
        WHERE mov.item_id = i.id
          AND (
            p_estoque_id IS NULL
            OR (COALESCE(p_incluir_sem_estoque, false) AND mov.estoque_id IS NULL)
          )
        ORDER BY mov.created_at DESC, mov.id DESC
        LIMIT 1
      )
    ) candidato
    ORDER BY candidato.created_at DESC, candidato.id DESC
    LIMIT 1
  ) m ON true
  ORDER BY i.id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_paginados_v3(uuid, boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_paginados_v3(uuid, boolean, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.obter_saldo_item_estoque_v1(
  p_item_id uuid,
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_saldo numeric;
BEGIN
  IF p_estoque_id IS NULL THEN
    SELECT m.quantidade_atual
      INTO v_saldo
    FROM public.movements m
    WHERE m.item_id = p_item_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1;
  ELSIF COALESCE(p_incluir_sem_estoque, false) THEN
    SELECT candidato.quantidade_atual
      INTO v_saldo
    FROM (
      (
        SELECT m.quantidade_atual, m.created_at, m.id
        FROM public.movements m
        WHERE m.item_id = p_item_id
          AND m.estoque_id = p_estoque_id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      )
      UNION ALL
      (
        SELECT m.quantidade_atual, m.created_at, m.id
        FROM public.movements m
        WHERE m.item_id = p_item_id
          AND m.estoque_id IS NULL
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      )
    ) candidato
    ORDER BY candidato.created_at DESC, candidato.id DESC
    LIMIT 1;
  ELSE
    SELECT m.quantidade_atual
      INTO v_saldo
    FROM public.movements m
    WHERE m.item_id = p_item_id
      AND m.estoque_id = p_estoque_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1;
  END IF;

  RETURN COALESCE(v_saldo, 0)::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_saldo_item_estoque_v1(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_saldo_item_estoque_v1(uuid, uuid, boolean) TO authenticated;

ANALYZE public.movements;
NOTIFY pgrst, 'reload schema';
