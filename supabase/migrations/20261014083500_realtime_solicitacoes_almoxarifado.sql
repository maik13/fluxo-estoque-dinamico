DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='cotacao_solicitacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacao_solicitacoes;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='solicitacoes_material'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_material;
  END IF;
END;
$$;