WITH normalized_threads AS (
  SELECT
    t.id,
    least(t.created_by, coalesce(t.recipient_id, t.viewer_id)) AS first_user_id,
    greatest(t.created_by, coalesce(t.recipient_id, t.viewer_id)) AS second_user_id,
    first_value(t.id) OVER (
      PARTITION BY
        least(t.created_by, coalesce(t.recipient_id, t.viewer_id)),
        greatest(t.created_by, coalesce(t.recipient_id, t.viewer_id))
      ORDER BY t.updated_at DESC, t.created_at DESC, t.id DESC
    ) AS canonical_thread_id
  FROM public.viewer_message_threads t
  WHERE coalesce(t.recipient_id, t.viewer_id) IS NOT NULL
    AND t.created_by IS NOT NULL
),
duplicate_threads AS (
  SELECT id, canonical_thread_id
  FROM normalized_threads
  WHERE id <> canonical_thread_id
)
UPDATE public.viewer_thread_messages m
SET thread_id = d.canonical_thread_id
FROM duplicate_threads d
WHERE m.thread_id = d.id;

WITH latest_messages AS (
  SELECT DISTINCT ON (m.thread_id)
    m.thread_id,
    m.message,
    m.created_at
  FROM public.viewer_thread_messages m
  ORDER BY m.thread_id, m.created_at DESC, m.id DESC
)
UPDATE public.viewer_message_threads t
SET last_message = lm.message,
    updated_at = greatest(t.updated_at, lm.created_at)
FROM latest_messages lm
WHERE t.id = lm.thread_id;

WITH normalized_threads AS (
  SELECT
    t.id,
    first_value(t.id) OVER (
      PARTITION BY
        least(t.created_by, coalesce(t.recipient_id, t.viewer_id)),
        greatest(t.created_by, coalesce(t.recipient_id, t.viewer_id))
      ORDER BY t.updated_at DESC, t.created_at DESC, t.id DESC
    ) AS canonical_thread_id
  FROM public.viewer_message_threads t
  WHERE coalesce(t.recipient_id, t.viewer_id) IS NOT NULL
    AND t.created_by IS NOT NULL
)
DELETE FROM public.viewer_message_threads t
USING normalized_threads n
WHERE t.id = n.id
  AND n.id <> n.canonical_thread_id;

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

  select t.id
  into v_thread_id
  from public.viewer_message_threads t
  where least(t.created_by, coalesce(t.recipient_id, t.viewer_id)) = least(v_creator_id, v_recipient_id)
    and greatest(t.created_by, coalesce(t.recipient_id, t.viewer_id)) = greatest(v_creator_id, v_recipient_id)
  order by t.updated_at desc, t.created_at desc
  limit 1;

  if v_thread_id is null then
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
  else
    update public.viewer_message_threads
    set last_message = p_message,
        updated_at = timezone('utc'::text, now())
    where id = v_thread_id;
  end if;

  insert into public.viewer_thread_messages (thread_id, sender_id, message)
  values (v_thread_id, v_creator_id, p_message);

  return v_thread_id;
end;
$function$;
