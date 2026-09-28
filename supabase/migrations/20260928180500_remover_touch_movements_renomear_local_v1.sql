BEGIN;

-- O Realtime já publica locais_utilizacao; não é necessário provocar UPDATE
-- em movements para refletir uma simples alteração de nome do Local.
CREATE OR REPLACE FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1() FROM PUBLIC;

COMMIT;
