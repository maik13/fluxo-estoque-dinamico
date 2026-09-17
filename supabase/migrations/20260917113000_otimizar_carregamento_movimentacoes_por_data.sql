CREATE INDEX IF NOT EXISTS idx_movements_data_hora_id
ON public.movements (data_hora, id);
