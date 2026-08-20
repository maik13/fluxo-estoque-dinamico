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
  v_mapa JSONB;
  v_permitido BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT p.tipo_usuario INTO v_tipo
    FROM public.profiles p
   WHERE p.user_id = v_user_id
     AND COALESCE(p.ativo, TRUE) = TRUE
   LIMIT 1;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_tipo = 'administrador' THEN RETURN TRUE; END IF;

  IF v_user_id = auth.uid()
     AND to_regprocedure('public.obter_minhas_permissoes()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.obter_minhas_permissoes()' INTO v_mapa;
      IF v_mapa IS NOT NULL
         AND v_mapa ? 'estoque.movimentacoes.editar' THEN
        RETURN COALESCE(NULLIF(v_mapa ->> 'estoque.movimentacoes.editar', '')::BOOLEAN, FALSE);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_mapa := NULL;
    END;
  END IF;

  IF to_regprocedure('public.permissao_individual_efetiva(uuid,text)') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.permissao_individual_efetiva($1, $2)'
        INTO v_permitido
        USING v_user_id, 'pode_editar_movimentacoes';
      IF v_permitido IS NOT NULL THEN RETURN v_permitido; END IF;
    EXCEPTION WHEN OTHERS THEN
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
    EXCEPTION WHEN undefined_column THEN
      RETURN FALSE;
    END;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_movimentacao_v1(
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
  v_resultado JSONB;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_pode_editar_movimentacoes_v1(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para editar movimentações';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  IF p_local_utilizacao_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locais_utilizacao l
     WHERE l.id = p_local_utilizacao_id
       AND COALESCE(l.ativo, TRUE) = TRUE
  ) THEN
    RAISE EXCEPTION 'Local de destino não encontrado ou inativo';
  END IF;

  SELECT * INTO v_mov
    FROM public.movements
   WHERE id = p_movimento_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  UPDATE public.movements
     SET local_utilizacao_id = p_local_utilizacao_id,
         quantidade = p_quantidade
   WHERE id = p_movimento_id
   RETURNING jsonb_build_object(
     'id', id,
     'local_utilizacao_id', local_utilizacao_id,
     'quantidade', quantidade
   ) INTO v_resultado;

  IF to_regclass('public.action_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.action_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        v_user,
        'EDICAO_MOVIMENTACAO',
        'movements',
        p_movimento_id,
        jsonb_build_object(
          'antiga_quantidade', v_mov.quantidade,
          'nova_quantidade', p_quantidade,
          'antigo_local_id', v_mov.local_utilizacao_id,
          'novo_local_id', p_local_utilizacao_id,
          'origem', 'editar_movimentacao_v1'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_movimentacao_v1(
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
  IF v_user IS NULL OR NOT public.usuario_pode_editar_movimentacoes_v1(v_user) THEN
    RAISE EXCEPTION 'Sem permissão para excluir movimentações';
  END IF;

  SELECT * INTO v_mov
    FROM public.movements
   WHERE id = p_movimento_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  DELETE FROM public.movements
   WHERE id = p_movimento_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'A movimentação não foi excluída'; END IF;

  IF to_regclass('public.action_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.action_logs (user_id, action, entity_type, entity_id, details)
      VALUES (
        v_user,
        'EXCLUSAO_MOVIMENTACAO',
        'movements',
        p_movimento_id,
        jsonb_build_object(
          'quantidade', v_mov.quantidade,
          'local_utilizacao_id', v_mov.local_utilizacao_id,
          'item_id', v_mov.item_id,
          'origem', 'excluir_movimentacao_v1'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('id', p_movimento_id, 'excluida', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.editar_movimentacao_v1(UUID, UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_movimentacao_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_movimentacao_v1(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_movimentacao_v1(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
