BEGIN;

CREATE TABLE IF NOT EXISTS public.viewer_message_receipts (
  message_id uuid NOT NULL REFERENCES public.viewer_thread_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS viewer_message_receipts_user_idx
  ON public.viewer_message_receipts(user_id, delivered_at, read_at);

ALTER TABLE public.viewer_message_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viewer_message_receipts_select_own ON public.viewer_message_receipts;
CREATE POLICY viewer_message_receipts_select_own
ON public.viewer_message_receipts
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.criar_recibo_mensagem_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_thread public.viewer_message_threads%ROWTYPE;
  v_participant uuid;
BEGIN
  SELECT * INTO v_thread
  FROM public.viewer_message_threads
  WHERE id = NEW.thread_id;

  IF v_thread.id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_participant IN
    SELECT DISTINCT x
    FROM unnest(ARRAY[v_thread.viewer_id, v_thread.created_by, v_thread.recipient_id]::uuid[]) AS x
    WHERE x IS NOT NULL
      AND x <> NEW.sender_id
  LOOP
    INSERT INTO public.viewer_message_receipts(message_id,user_id)
    VALUES (NEW.id,v_participant)
    ON CONFLICT (message_id,user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_recibo_mensagem_v1 ON public.viewer_thread_messages;
CREATE TRIGGER trg_criar_recibo_mensagem_v1
AFTER INSERT ON public.viewer_thread_messages
FOR EACH ROW
EXECUTE FUNCTION public.criar_recibo_mensagem_v1();

-- Backfill das mensagens existentes. Se já estavam marcadas como lidas na conversa,
-- considera entregue e lida; caso contrário, cria o recibo ainda pendente.
INSERT INTO public.viewer_message_receipts(message_id,user_id,delivered_at,read_at)
SELECT
  m.id,
  participante.user_id,
  CASE WHEN r.last_read_at >= m.created_at THEN r.last_read_at ELSE NULL END,
  CASE WHEN r.last_read_at >= m.created_at THEN r.last_read_at ELSE NULL END
FROM public.viewer_thread_messages m
JOIN public.viewer_message_threads t ON t.id=m.thread_id
CROSS JOIN LATERAL (
  SELECT DISTINCT x AS user_id
  FROM unnest(ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[]) AS x
  WHERE x IS NOT NULL AND x <> m.sender_id
) participante
LEFT JOIN public.viewer_thread_reads r
  ON r.thread_id=m.thread_id
 AND r.user_id=participante.user_id
ON CONFLICT (message_id,user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.marcar_mensagens_entregues_v1()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count bigint;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.viewer_message_receipts
  SET delivered_at=COALESCE(delivered_at,now()),
      updated_at=now()
  WHERE user_id=v_user
    AND delivered_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

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
    WHERE t.id=p_thread_id
      AND v_user = ANY (ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[])
  ) THEN
    RAISE EXCEPTION 'Usuário não participa desta conversa';
  END IF;

  INSERT INTO public.viewer_thread_reads(thread_id,user_id,last_read_at,updated_at)
  VALUES (p_thread_id,v_user,now(),now())
  ON CONFLICT (thread_id,user_id) DO UPDATE
  SET last_read_at=excluded.last_read_at,
      updated_at=excluded.updated_at;

  UPDATE public.viewer_message_receipts r
  SET delivered_at=COALESCE(r.delivered_at,now()),
      read_at=COALESCE(r.read_at,now()),
      updated_at=now()
  FROM public.viewer_thread_messages m
  WHERE r.message_id=m.id
    AND r.user_id=v_user
    AND m.thread_id=p_thread_id
    AND r.read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_recibos_thread_v1(p_thread_id uuid)
RETURNS TABLE(message_id uuid, delivered_at timestamptz, read_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.message_id,r.delivered_at,r.read_at
  FROM public.viewer_message_receipts r
  JOIN public.viewer_thread_messages m ON m.id=r.message_id
  JOIN public.viewer_message_threads t ON t.id=m.thread_id
  WHERE m.thread_id=p_thread_id
    AND auth.uid() IS NOT NULL
    AND (
      m.sender_id=auth.uid()
      OR r.user_id=auth.uid()
      OR auth.uid() = ANY (ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[])
    );
$$;

CREATE OR REPLACE FUNCTION public.listar_mensagens_nao_lidas_detalhes_v1(p_limite integer DEFAULT 20)
RETURNS TABLE(
  id uuid,
  thread_id uuid,
  sender_id uuid,
  message text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id,m.thread_id,m.sender_id,m.message,m.created_at
  FROM public.viewer_thread_messages m
  JOIN public.viewer_message_threads t ON t.id=m.thread_id
  LEFT JOIN public.viewer_thread_reads r
    ON r.thread_id=t.id
   AND r.user_id=auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND auth.uid() = ANY (ARRAY[t.viewer_id,t.created_by,t.recipient_id]::uuid[])
    AND m.sender_id <> auth.uid()
    AND m.created_at > COALESCE(r.last_read_at,'epoch'::timestamptz)
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1,LEAST(COALESCE(p_limite,20),100));
$$;

REVOKE ALL ON FUNCTION public.marcar_mensagens_entregues_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_recibos_thread_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_mensagens_nao_lidas_detalhes_v1(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_mensagens_entregues_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_recibos_thread_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_mensagens_nao_lidas_detalhes_v1(integer) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='viewer_message_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.viewer_message_receipts;
  END IF;
END $$;

COMMIT;