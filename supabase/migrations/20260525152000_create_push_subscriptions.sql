CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

UPDATE public.push_subscriptions
SET endpoint = COALESCE(endpoint, subscription ->> 'endpoint', id::text)
WHERE endpoint IS NULL;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN endpoint SET NOT NULL;

DELETE FROM public.push_subscriptions ps
USING (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY user_id, endpoint
        ORDER BY created_at DESC, id DESC
      ) AS duplicate_rank
    FROM public.push_subscriptions
  ) ranked
  WHERE ranked.duplicate_rank > 1
) duplicates
WHERE ps.id = duplicates.id;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_endpoint_idx
ON public.push_subscriptions (user_id, endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
