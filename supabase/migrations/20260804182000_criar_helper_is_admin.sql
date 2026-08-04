-- Helper administrativo compatível com o perfil real do sistema.
-- Corrige migrations e RPCs que dependem de public.is_admin().

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.ativo, FALSE) = TRUE
      AND p.tipo_usuario = 'administrador'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
