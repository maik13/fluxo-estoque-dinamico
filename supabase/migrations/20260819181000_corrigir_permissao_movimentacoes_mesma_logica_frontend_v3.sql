-- Corrige a autorização de UPDATE/DELETE em movements para seguir exatamente
-- a mesma estratégia usada pelo frontend em usePermissions:
-- 1) administrador ativo tem acesso;
-- 2) usa obter_minhas_permissoes() apenas quando a RPC existe e responde;
-- 3) se a RPC não existe ou falha, cai para permissoes_tipo_usuario.pode_editar_movimentacoes.
--
-- Isso elimina o caso em que o botão aparece pelo fallback legado, mas o RLS
-- consulta tabelas parciais do modelo novo e bloqueia silenciosamente a linha.

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

  -- O frontend considera administrador ativo como autorizado.
  IF v_tipo = 'administrador' THEN
    RETURN TRUE;
  END IF;

  -- Replica a lógica do frontend: o modelo novo só é fonte de verdade se a
  -- RPC obter_minhas_permissoes() estiver instalada e responder corretamente.
  IF v_user_id = auth.uid()
     AND to_regprocedure('public.obter_minhas_permissoes()') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT public.obter_minhas_permissoes()'
        INTO v_mapa;

      -- Se a RPC respondeu, o frontend NÃO usa o legado. Uma chave ausente
      -- equivale a false, exatamente como mapaParaLegado/hasPermission.
      IF v_mapa IS NULL THEN
        RETURN FALSE;
      END IF;

      RETURN COALESCE(
        NULLIF(v_mapa ->> 'estoque.movimentacoes.editar', '')::BOOLEAN,
        FALSE
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- É exatamente o fallback do frontend quando a RPC falha.
        v_mapa := NULL;
    END;
  END IF;

  -- Modelo legado/fallback usado pelo frontend quando a RPC nova não existe
  -- ou não responde.
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

REVOKE ALL
ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.usuario_pode_editar_movimentacoes_v1(UUID)
TO authenticated;

-- Recria as policies para garantir que não reste nenhuma regra antiga
-- hardcoded por cargo.
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

NOTIFY pgrst, 'reload schema';

COMMIT;
