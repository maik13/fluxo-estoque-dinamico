BEGIN;

-- Corrige duas devoluções históricas do item 513 em que a movimentação foi
-- registrada como entrada de 1 unidade, mas quantidade_atual permaneceu 0.
ALTER TABLE public.movements DISABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

UPDATE public.movements
SET quantidade_atual = quantidade_anterior + quantidade
WHERE id IN (
  '4d2d4d54-36dd-4f3a-8f5b-982a1877f199'::uuid,
  '1b60a3cf-8eea-4fbe-ab91-3de4fa1fd703'::uuid
)
  AND tipo = 'ENTRADA'
  AND quantidade = 1
  AND quantidade_anterior = 0;

ALTER TABLE public.movements ENABLE TRIGGER trg_validar_permissao_mutacao_movements_v1;

-- A posição atual de estoque deve reproduzir exatamente o estado persistido
-- pela última movimentação daquele item dentro do estoque selecionado.
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
  SELECT m.*
  FROM public.movements m
  WHERE auth.uid() IS NOT NULL
    AND (
      p_estoque_id IS NULL
      OR m.estoque_id = p_estoque_id
      OR (p_incluir_sem_estoque AND m.estoque_id IS NULL)
    )
),
ultima AS (
  SELECT DISTINCT ON (m.item_id)
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
  FROM movimentos m
  ORDER BY m.item_id, m.data_hora DESC, m.id DESC
)
SELECT item_id, saldo_atual, ultima_movimentacao
FROM ultima;
$$;

REVOKE ALL ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_saldos_estoque_v1(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
