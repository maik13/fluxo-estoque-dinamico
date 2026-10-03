BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS especificacoes_dimensoes TEXT NULL;

COMMENT ON COLUMN public.items.especificacoes_dimensoes IS
  'Especificações físicas e dimensões da peça, preservadas separadamente do nome do item.';

CREATE TABLE IF NOT EXISTS public.catalogo_2025_movements_backup_20261003 AS
SELECT
  m.id AS movement_id,
  m.item_id,
  m.data_hora,
  m.tipo,
  m.quantidade,
  m.quantidade_anterior,
  m.quantidade_atual,
  m.item_snapshot,
  now() AS backup_criado_em
FROM public.movements m
JOIN public.items i ON i.id=m.item_id
WHERE i.catalogo_ano=2025
  AND (m.data_hora AT TIME ZONE 'America/Sao_Paulo')::date <= DATE '2026-09-22';

CREATE UNIQUE INDEX IF NOT EXISTS catalogo_2025_movements_backup_20261003_uidx
  ON public.catalogo_2025_movements_backup_20261003(movement_id);

COMMIT;
NOTIFY pgrst, 'reload schema';