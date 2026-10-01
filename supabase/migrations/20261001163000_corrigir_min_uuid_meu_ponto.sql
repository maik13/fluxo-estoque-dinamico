BEGIN;

CREATE OR REPLACE FUNCTION public.rh_current_user_colaborador_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_colaborador_id uuid;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT c.id
  INTO v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id = v_user_id
    AND c.ativo = true
    AND c.rh_ativo = true
    AND c.controla_ponto = true
  LIMIT 1;

  IF v_colaborador_id IS NOT NULL THEN
    RETURN v_colaborador_id;
  END IF;

  SELECT lower(btrim(coalesce(p.email, u.email, '')))
  INTO v_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = v_user_id;

  IF coalesce(v_email, '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.rh_colaboradores c
  WHERE c.user_id IS NULL
    AND c.ativo = true
    AND c.rh_ativo = true
    AND c.controla_ponto = true
    AND lower(btrim(coalesce(c.email, ''))) = v_email;

  IF v_count <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT c.id
  INTO v_colaborador_id
  FROM public.rh_colaboradores c
  WHERE c.user_id IS NULL
    AND c.ativo = true
    AND c.rh_ativo = true
    AND c.controla_ponto = true
    AND lower(btrim(coalesce(c.email, ''))) = v_email
  LIMIT 1;

  IF v_colaborador_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.rh_colaboradores
  SET user_id = v_user_id
  WHERE id = v_colaborador_id
    AND user_id IS NULL;

  RETURN v_colaborador_id;
END;
$function$;

COMMIT;
NOTIFY pgrst, 'reload schema';