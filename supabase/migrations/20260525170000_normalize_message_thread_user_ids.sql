UPDATE public.viewer_message_threads t
SET viewer_id = p.user_id
FROM public.profiles p
WHERE t.viewer_id = p.id
  AND p.user_id IS NOT NULL;

UPDATE public.viewer_message_threads t
SET recipient_id = p.user_id
FROM public.profiles p
WHERE t.recipient_id = p.id
  AND p.user_id IS NOT NULL;

UPDATE public.viewer_message_threads t
SET created_by = p.user_id
FROM public.profiles p
WHERE t.created_by = p.id
  AND p.user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.start_user_message_thread(
  p_recipient_id uuid,
  p_message text,
  p_requested_date text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_thread_id uuid;
  v_creator_id uuid;
  v_recipient_id uuid;
begin
  v_creator_id := auth.uid();
  if v_creator_id is null then
    raise exception 'Não autorizado';
  end if;

  select coalesce(p.user_id, p_recipient_id)
  into v_recipient_id
  from public.profiles p
  where p.user_id = p_recipient_id
     or p.id = p_recipient_id
  limit 1;

  v_recipient_id := coalesce(v_recipient_id, p_recipient_id);

  insert into public.viewer_message_threads (
    viewer_id,
    created_by,
    recipient_id,
    last_message,
    requested_date,
    updated_at
  )
  values (
    v_recipient_id,
    v_creator_id,
    v_recipient_id,
    p_message,
    p_requested_date,
    timezone('utc'::text, now())
  )
  returning id into v_thread_id;

  insert into public.viewer_thread_messages (thread_id, sender_id, message)
  values (v_thread_id, v_creator_id, p_message);

  return v_thread_id;
end;
$function$;
