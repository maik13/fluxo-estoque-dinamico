ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS dedupe_key text;

UPDATE public.movements
SET dedupe_key = concat_ws(
  '|',
  item_id::text,
  tipo,
  quantidade::text,
  coalesce(user_id::text, ''),
  coalesce(estoque_id::text, ''),
  coalesce(tipo_operacao_id::text, ''),
  coalesce(observacoes, ''),
  floor(extract(epoch from data_hora))::text
)
WHERE item_id IS NOT NULL
  AND data_hora IS NOT NULL
  AND dedupe_key IS NULL;

WITH duplicate_movements AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY dedupe_key
        ORDER BY created_at, id
      ) AS rn
    FROM public.movements
    WHERE dedupe_key IS NOT NULL
  ) ranked
  WHERE rn > 1
)
DELETE FROM public.movements m
USING duplicate_movements d
WHERE m.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS movements_dedupe_key_idx
ON public.movements (dedupe_key)
WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_movement_dedupe_key()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.item_id IS NOT NULL AND NEW.data_hora IS NOT NULL THEN
    NEW.dedupe_key := concat_ws(
      '|',
      NEW.item_id::text,
      NEW.tipo,
      NEW.quantidade::text,
      coalesce(NEW.user_id::text, ''),
      coalesce(NEW.estoque_id::text, ''),
      coalesce(NEW.tipo_operacao_id::text, ''),
      coalesce(NEW.observacoes, ''),
      floor(extract(epoch from NEW.data_hora))::text
    );
  ELSE
    NEW.dedupe_key := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_movement_dedupe_key_before_insert_update ON public.movements;

CREATE TRIGGER set_movement_dedupe_key_before_insert_update
BEFORE INSERT OR UPDATE ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.set_movement_dedupe_key();
