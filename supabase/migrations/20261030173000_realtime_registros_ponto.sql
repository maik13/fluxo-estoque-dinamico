BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rh_registros_ponto'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rh_registros_ponto;
  END IF;
END;
$$;

COMMIT;
