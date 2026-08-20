-- Compatibiliza bancos onde action_logs ainda não existe e reaplica a correção
-- de edição/exclusão de movimentações com a mesma permissão efetiva do frontend.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Garante a existência da estrutura de auditoria usada pelo frontend.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NULL,
  details JSONB NULL
);

ALTER TABLE public.action_logs
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID NULL,
  ADD COLUMN IF NOT EXISTS details JSONB NULL;

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Qualquer usuário autenticado pode inserir logs"
  ON public.action_logs;
DROP POLICY IF EXISTS "Usuário autenticado insere o próprio log"
  ON public.action_logs;
DROP POLICY IF EXISTS "Apenas administradores podem ler logs"
  ON public.action_logs;

CREATE POLICY "Usuário autenticado insere o próprio log"
ON public.action_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Apenas administradores podem ler logs"
ON public.action_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.user_id = auth.uid()
       AND p.tipo_usuario = 'administrador'
       AND COALESCE(p.ativo, TRUE) = TRUE
  )
);

-- ---------------------------------------------------------------------------
-- 2. Autoriza editar/excluir usando a mesma permissão efetiva do frontend.
-- ---------------------------------------------------------------------------
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
  v_mapa JSONB;
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

  IF v_tipo = 'administrador' THEN
    RETURN TRUE;
  END IF;

  IF v_user_id = auth.uid()
     AND to_regprocedure('public.obter_minhas_permissoes()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.obter_minhas_permissoes()'
        INTO v_mapa;

      IF v_mapa IS NOT NULL
         AND v_mapa ? 'estoque.movimentacoes.editar' THEN
        RETURN COALESCE(
          NULLIF(v_mapa ->> 'estoque.movimentacoes.editar', '')::BOOLEAN,
          FALSE
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_mapa := NULL;
    END;
  END IF;

  IF to_regprocedure('public.permissao_individual_efetiva(uuid,text)') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.permissao_individual_efetiva($1, $2)'
        INTO v_permitido
        USING v_user_id, 'pode_editar_movimentacoes';

      IF v_permitido IS NOT NULL THEN
        RETURN v_permitido;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_permitido := NULL;
    END;
  END IF;

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
    EXCEPTION
      WHEN undefined_column THEN
        RETURN FALSE;
    END;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID) TO authenticated;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'movements'
       AND cmd IN ('UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.movements', v_policy.policyname);
  END LOOP;
END $$;

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

-- ---------------------------------------------------------------------------
-- 3. O log de edição reaplica a alteração com SECURITY DEFINER.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplicar_edicao_movimentacao_por_log_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_movimento_id UUID;
  v_local_id UUID;
  v_quantidade NUMERIC;
  v_afetadas INTEGER;
BEGIN
  IF NEW.action IS DISTINCT FROM 'EDICAO_MOVIMENTACAO'
     OR NEW.entity_type IS DISTINCT FROM 'movements' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR NOT public.usuario_pode_editar_movimentacoes_v1(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para editar movimentações';
  END IF;

  v_movimento_id := NEW.entity_id;

  IF v_movimento_id IS NULL THEN
    RAISE EXCEPTION 'ID da movimentação não informado';
  END IF;

  IF NULLIF(NEW.details ->> 'novo_local_id', '') IS NULL THEN
    v_local_id := NULL;
  ELSE
    BEGIN
      v_local_id := (NEW.details ->> 'novo_local_id')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Local de destino inválido';
    END;
  END IF;

  BEGIN
    v_quantidade := (NEW.details ->> 'nova_quantidade')::NUMERIC;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Quantidade inválida';
  END;

  IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  IF v_local_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.locais_utilizacao l
     WHERE l.id = v_local_id
       AND COALESCE(l.ativo, TRUE) = TRUE
  ) THEN
    RAISE EXCEPTION 'Local de destino não encontrado ou inativo';
  END IF;

  UPDATE public.movements
     SET local_utilizacao_id = v_local_id,
         quantidade = v_quantidade
   WHERE id = v_movimento_id;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;

  IF v_afetadas <> 1 THEN
    RAISE EXCEPTION 'A movimentação não foi encontrada para atualização';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_edicao_movimentacao_por_log_v1
  ON public.action_logs;

CREATE TRIGGER trg_aplicar_edicao_movimentacao_por_log_v1
AFTER INSERT ON public.action_logs
FOR EACH ROW
WHEN (
  NEW.action = 'EDICAO_MOVIMENTACAO'
  AND NEW.entity_type = 'movements'
)
EXECUTE FUNCTION public.aplicar_edicao_movimentacao_por_log_v1();

REVOKE ALL ON FUNCTION public.aplicar_edicao_movimentacao_por_log_v1() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;
