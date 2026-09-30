BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deve_trocar_senha BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS senha_redefinida_em TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.concluir_primeiro_acesso()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  UPDATE public.profiles
  SET deve_trocar_senha = false,
      senha_redefinida_em = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_primeiro_acesso() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.concluir_primeiro_acesso() TO authenticated;

COMMIT;