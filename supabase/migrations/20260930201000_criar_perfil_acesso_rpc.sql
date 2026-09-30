BEGIN;

CREATE OR REPLACE FUNCTION public.criar_perfil_acesso(p_tipo_usuario TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo TEXT;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin()
     AND NOT public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_usuarios') THEN
    RAISE EXCEPTION 'Sem permissão para criar perfil de acesso';
  END IF;

  v_tipo := lower(regexp_replace(trim(p_tipo_usuario), '\s+', '_', 'g'));

  IF v_tipo IS NULL OR v_tipo = '' OR v_tipo !~ '^[a-z0-9_]+$' OR length(v_tipo) > 80 THEN
    RAISE EXCEPTION 'Nome de perfil inválido';
  END IF;

  INSERT INTO public.permissoes_tipo_usuario(tipo_usuario)
  VALUES (v_tipo)
  ON CONFLICT (tipo_usuario) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.permissoes_tipo_usuario
    WHERE tipo_usuario = v_tipo;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_perfil_acesso(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_perfil_acesso(TEXT) TO authenticated;

COMMIT;