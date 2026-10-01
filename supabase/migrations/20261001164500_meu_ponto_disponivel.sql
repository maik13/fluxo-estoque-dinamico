BEGIN;

CREATE OR REPLACE FUNCTION public.rh_meu_ponto_disponivel()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.rh_current_user_colaborador_id() IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.rh_meu_ponto_disponivel() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_meu_ponto_disponivel() TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';