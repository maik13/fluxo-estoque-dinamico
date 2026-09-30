-- A função listar_saldos_estoque_v1 localiza a última movimentação de cada
-- item no estoque selecionado. Estes índices acompanham o filtro e a ordem
-- usados pela função, evitando varreduras integrais em bases com histórico alto.
CREATE INDEX IF NOT EXISTS idx_movements_estoque_item_ultima
  ON public.movements (estoque_id, item_id, data_hora DESC, id DESC)
  WHERE estoque_id IS NOT NULL;

-- O almoxarifado principal também inclui movimentações históricas sem estoque.
CREATE INDEX IF NOT EXISTS idx_movements_sem_estoque_item_ultima
  ON public.movements (item_id, data_hora DESC, id DESC)
  WHERE estoque_id IS NULL;
