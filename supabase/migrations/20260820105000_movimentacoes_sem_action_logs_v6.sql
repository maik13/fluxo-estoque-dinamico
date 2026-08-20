-- Corrige edição/exclusão de movimentações sem depender de public.action_logs.
-- A migration é autocontida e compatível com os modelos de permissão existentes.

BEGIN;

CREATE OR REPLACE FUNCTION public.usuario_pode_editar_movimentacoes_v2(
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

  IF v_tipo = 'administrador' THEN
    RETURN TRUE;
  END IF;

  -- Modelo global atual: exceção individual por chave de catálogo.
  IF to_regclass('public.usuario_permissoes') IS NOT NULL
     AND to_regclass('public.permissoes_catalogo') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT up.efeito
          FROM public.usuario_permissoes up
          JOIN public.permissoes_catalogo c
            ON c.id = up.permissao_id
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
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        v_efeito := NULL;
    END;
  END IF;

  -- Modelo individual anterior: exceção pelo nome do campo legado.
  IF to_regclass('public.usuario_permissoes_individuais') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT upi.efeito
          FROM public.usuario_permissoes_individuais upi
         WHERE upi.user_id = $1
           AND upi.permissao = 'pode_editar_movimentacoes'
         LIMIT 1
      $sql$
      INTO v_efeito
      USING v_user_id;

      IF v_efeito = 'negar' THEN
        RETURN FALSE;
      ELSIF v_efeito = 'permitir' THEN
        RETURN TRUE;
      END IF;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        v_efeito := NULL;
    END;
  END IF;

  -- Herança pelo perfil no modelo global atual.
  IF to_regclass('public.perfil_permissoes') IS NOT NULL
     AND to_regclass('public.permissoes_catalogo') IS NOT NULL THEN
    BEGIN
      EXECUTE $sql$
        SELECT pp.permitido
          FROM public.perfil_permissoes pp
          JOIN public.permissoes_catalogo c
            ON c.id = pp.permissao_id
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
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        v_permitido := NULL;
    END;
  END IF;

  -- Matriz legada por perfil.
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
      WHEN undefined_table OR undefined_column THEN
        RETURN FALSE;
    END;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.usuario_pode_editar_movimentacoes_v2(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_pode_editar_movimentacoes_v2(UUID) TO authenticated;

-- Remove qualquer policy antiga de UPDATE/DELETE em movements para evitar
-- regras concorrentes ou resíduos de migrations anteriores.
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

CREATE POLICY "Movements editable by effective permission v2"
ON public.movements
FOR UPDATE
TO authenticated
USING (public.usuario_pode_editar_movimentacoes_v2())
WITH CHECK (public.usuario_pode_editar_movimentacoes_v2());

CREATE POLICY "Movements deletable by effective permission v2"
ON public.movements
FOR DELETE
TO authenticated
USING (public.usuario_pode_editar_movimentacoes_v2());

-- RPC determinística para a próxima versão do frontend e para diagnóstico:
-- ou altera exatamente uma movimentação, ou lança erro.
CREATE OR REPLACE FUNCTION public.editar_movimentacao_estoque_v1(
  p_movimento_id UUID,
  p_local_utilizacao_id UUID,
  p_quantidade NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mov public.movements%ROWTYPE;
  v_local_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_pode_editar_movimentacoes_v2(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para editar movimentações';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  SELECT *
    INTO v_mov
    FROM public.movements
   WHERE id = p_movimento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  IF p_local_utilizacao_id IS NOT NULL THEN
    SELECT l.nome
      INTO v_local_nome
      FROM public.locais_utilizacao l
     WHERE l.id = p_local_utilizacao_id
       AND COALESCE(l.ativo, TRUE) = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Local de destino não encontrado ou inativo';
    END IF;
  END IF;

  UPDATE public.movements
     SET local_utilizacao_id = p_local_utilizacao_id,
         quantidade = p_quantidade
   WHERE id = p_movimento_id;

  RETURN jsonb_build_object(
    'id', p_movimento_id,
    'local_utilizacao_id', p_local_utilizacao_id,
    'local_utilizacao_nome', v_local_nome,
    'quantidade', p_quantidade,
    'alterado', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_movimentacao_estoque_v1(
  p_movimento_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_mov public.movements%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_pode_editar_movimentacoes_v2(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para excluir movimentações';
  END IF;

  SELECT *
    INTO v_mov
    FROM public.movements
   WHERE id = p_movimento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  DELETE FROM public.movements
   WHERE id = p_movimento_id;

  RETURN jsonb_build_object(
    'id', p_movimento_id,
    'excluido', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editar_movimentacao_estoque_v1(UUID, UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_movimentacao_estoque_v1(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.editar_movimentacao_estoque_v1(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_movimentacao_estoque_v1(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
