BEGIN;

CREATE TABLE IF NOT EXISTS public.viewer_thread_reads (
  thread_id uuid NOT NULL REFERENCES public.viewer_message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

ALTER TABLE public.viewer_thread_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viewer_thread_reads_select_own ON public.viewer_thread_reads;
CREATE POLICY viewer_thread_reads_select_own
ON public.viewer_thread_reads
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS viewer_thread_reads_insert_own ON public.viewer_thread_reads;
CREATE POLICY viewer_thread_reads_insert_own
ON public.viewer_thread_reads
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS viewer_thread_reads_update_own ON public.viewer_thread_reads;
CREATE POLICY viewer_thread_reads_update_own
ON public.viewer_thread_reads
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.marcar_thread_como_lida_v1(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.viewer_message_threads t
    WHERE t.id = p_thread_id
      AND v_user = ANY (ARRAY[t.viewer_id, t.created_by, t.recipient_id]::uuid[])
  ) THEN
    RAISE EXCEPTION 'Usuário não participa desta conversa';
  END IF;

  INSERT INTO public.viewer_thread_reads(thread_id,user_id,last_read_at,updated_at)
  VALUES (p_thread_id,v_user,now(),now())
  ON CONFLICT (thread_id,user_id) DO UPDATE
  SET last_read_at=excluded.last_read_at,
      updated_at=excluded.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.contar_mensagens_nao_lidas_v1()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::bigint
  FROM public.viewer_thread_messages m
  JOIN public.viewer_message_threads t ON t.id=m.thread_id
  LEFT JOIN public.viewer_thread_reads r
    ON r.thread_id=t.id
   AND r.user_id=auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND auth.uid() = ANY (ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[])
    AND m.sender_id <> auth.uid()
    AND m.created_at > coalesce(r.last_read_at,'epoch'::timestamptz);
$$;

CREATE OR REPLACE FUNCTION public.listar_mensagens_nao_lidas_por_thread_v1()
RETURNS TABLE(thread_id uuid, quantidade bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.thread_id,count(*)::bigint
  FROM public.viewer_thread_messages m
  JOIN public.viewer_message_threads t ON t.id=m.thread_id
  LEFT JOIN public.viewer_thread_reads r
    ON r.thread_id=t.id
   AND r.user_id=auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND auth.uid() = ANY (ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[])
    AND m.sender_id <> auth.uid()
    AND m.created_at > coalesce(r.last_read_at,'epoch'::timestamptz)
  GROUP BY m.thread_id;
$$;

REVOKE ALL ON FUNCTION public.marcar_thread_como_lida_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.contar_mensagens_nao_lidas_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_mensagens_nao_lidas_por_thread_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_thread_como_lida_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contar_mensagens_nao_lidas_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_mensagens_nao_lidas_por_thread_v1() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='viewer_thread_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewer_thread_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='viewer_message_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewer_message_threads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='viewer_thread_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewer_thread_reads;
  END IF;
END $$;

COMMIT;