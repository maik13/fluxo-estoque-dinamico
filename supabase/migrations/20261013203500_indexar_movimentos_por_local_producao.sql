CREATE INDEX IF NOT EXISTS idx_movements_local_utilizacao_id_id ON public.movements(local_utilizacao_id,id);
ANALYZE public.movements;