-- Corrige UPDATE/DELETE de movimentações em bancos que ainda não possuem
-- public.usuario_tem_permissao(). A autorização continua baseada na permissão
-- efetiva do usuário, com suporte ao modelo novo e ao legado.

BEGIN;

CREATE OR REPLACE FUNCTION public.usuario_pode_editar_movimentacoes_v1(
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_tipo TEXT;
  v_efeito TEXT;
  v_permitido BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT p.tipo_usuario
    INTO v_tipo
    FROM public.profiles p
   WHERE p.user_id = v_user_id
     AND COALESCE(p.ativo, TRUE) = TRUE
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Modelo novo: exceção individual tem precedência, quando as tabelas existem.
  IF to_regclass('public.usuario_permissoes') IS NOT NULL
     AND to_regclass('public.permissoes_catalogo') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT up.efeito
        FROM public.usuario_permissoes up
        JOIN public.permissoes_catalogo c ON c.id = up.permissao_id
       WHERE up.user_id = $1
         AND c.chave = 'estoque.movimentacoes.editar'
         AND COALESCE(c.ativo, TRUE) = TRUE
       LIMIT 1
    $sql$
      INTO v_efeito
      USING v_user_id;

    IF v_efeito = 'negar' THEN
      RETURN FALSE;
    ELSIF v_efeito = 'permitir' THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Modelo novo: permissão herdada do perfil.
  IF to_regclass('public.perfil_permissoes') IS NOT NULL
     AND to_regclass('public.permissoes_catalogo') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT pp.permitido
        FROM public.perfil_permissoes pp
        JOIN public.permissoes_catalogo c ON c.id = pp.permissao_id
       WHERE pp.tipo_usuario = $1
         AND c.chave = 'estoque.movimentacoes.editar'
         AND COALESCE(c.ativo, TRUE) = TRUE
       LIMIT 1
    $sql$
      INTO v_permitido
      USING v_tipo;

    IF v_permitido IS NOT NULL THEN
      RETURN v_permitido;
    END IF;
  END IF;

  -- Modelo legado: mesma permissão que a interface já utiliza como fallback.
  IF to_regclass('public.permissoes_tipo_usuario') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT ptu.pode_editar_movimentacoes
          FROM public.permissoes_tipo_usuario ptu
         WHERE ptu.tipo_usuario = $1
         LIMIT 1
      $sql$
        INTO v_permitido
        USING v_tipo;

      RETURN COALESCE(v_permitido, FALSE);
    EXCEPTION WHEN undefined_column THEN
      RETURN FALSE;
    END;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID) TO authenticated;

-- Remove políticas antigas/conflitantes antes de recriar as duas políticas efetivas.
DROP POLICY IF EXISTS "movements_update_all_auth" ON public.movements;
DROP POLICY IF EXISTS "movements_delete_all_auth" ON public.movements;
DROP POLICY IF EXISTS "Movements can be updated by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Movements can be deleted by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Inventory managers can update movements" ON public.movements;
DROP POLICY IF EXISTS "Only admins can delete movements" ON public.movements;
DROP POLICY IF EXISTS "Movements editable by effective permission" ON public.movements;
DROP POLICY IF EXISTS "Movements deletable by effective permission" ON public.movements;

CREATE POLICY "Movements editable by effective permission"
ON public.movements
FOR UPDATE
TO authenticated
USING (public.usuario_pode_editar_movimentacoes_v1())
WITH CHECK (public.usuario_pode_editar_movimentacoes_v1());

CREATE POLICY "Movements deletable by effective permission"
ON public.movements
FOR DELETE
TO authenticated
USING (public.usuario_pode_editar_movimentacoes_v1());

-- Realtime idempotente para refletir UPDATE/DELETE sem depender de refresh manual.
ALTER TABLE public.movements REPLICA IDENTITY FULL;
ALTER TABLE public.locais_utilizacao REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'locais_utilizacao'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locais_utilizacao;
  END IF;
END $$;

-- Mantém o vínculo pelo ID e provoca atualização das linhas quando o local/projeto
-- for renomeado, para clientes abertos buscarem o nome atual.
CREATE OR REPLACE FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.movements
       SET local_utilizacao_id = local_utilizacao_id
     WHERE local_utilizacao_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_movimentacoes_apos_renomear_local_v1
  ON public.locais_utilizacao;

CREATE TRIGGER trg_notificar_movimentacoes_apos_renomear_local_v1
AFTER UPDATE OF nome
ON public.locais_utilizacao
FOR EACH ROW
WHEN (OLD.nome IS DISTINCT FROM NEW.nome)
EXECUTE FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1();

REVOKE ALL ON FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;
