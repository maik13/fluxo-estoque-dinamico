DO $$
BEGIN
  IF to_regclass('public.usuario_permissoes_individuais') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname='supabase_realtime'
         AND schemaname='public'
         AND tablename='usuario_permissoes_individuais'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.usuario_permissoes_individuais;
  END IF;

  IF to_regclass('public.permissoes_tipo_usuario') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname='supabase_realtime'
         AND schemaname='public'
         AND tablename='permissoes_tipo_usuario'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.permissoes_tipo_usuario;
  END IF;
END $$;