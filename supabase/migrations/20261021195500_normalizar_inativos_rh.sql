BEGIN;

-- Registra e elimina vínculos operacionais residuais dos cadastros já inativos.
INSERT INTO public.rh_contextos_auditoria (
  colaborador_id,
  ativo_anterior, ativo_novo,
  administrativo_anterior, administrativo_novo,
  pista_anterior, pista_novo,
  ponto_anterior, ponto_novo,
  origem, alterado_por
)
SELECT
  id,
  ativo, false,
  rh_ativo, false,
  pista_ativo_legado, false,
  controla_ponto, false,
  'normalizacao_inativos_legados', null
FROM public.rh_colaboradores
WHERE ativo = false
  AND (rh_ativo OR pista_ativo_legado OR controla_ponto);

UPDATE public.rh_colaboradores
SET rh_ativo = false,
    pista_ativo_legado = false,
    controla_ponto = false,
    updated_at = now()
WHERE ativo = false
  AND (rh_ativo OR pista_ativo_legado OR controla_ponto);

UPDATE public.producao_membros pm
SET ativo = false,
    updated_at = now()
WHERE pm.rh_colaborador_id IN (
  SELECT rc.id FROM public.rh_colaboradores rc WHERE rc.ativo = false
);

CREATE OR REPLACE FUNCTION public.rh_set_colaborador_contextos_v3(
  p_colaborador_id uuid,
  p_ativo boolean,
  p_administrativo_ativo boolean,
  p_pista_ativo boolean,
  p_controla_ponto boolean,
  p_origem text DEFAULT 'interface_rh'
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_atual public.rh_colaboradores%ROWTYPE;
  v_ativo boolean := coalesce(p_ativo, false);
  v_administrativo boolean := v_ativo AND coalesce(p_administrativo_ativo, false);
  v_pista boolean := v_ativo AND coalesce(p_pista_ativo, false);
  v_ponto boolean := v_ativo AND coalesce(p_controla_ponto, false);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user, 'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar colaboradores do RH';
  END IF;

  IF v_ativo AND NOT (v_administrativo OR v_pista OR v_ponto) THEN
    RAISE EXCEPTION 'Um cadastro ativo precisa ter ao menos um vínculo: Administrativo, Pista ou Controle de ponto';
  END IF;

  SELECT * INTO v_atual
  FROM public.rh_colaboradores
  WHERE id = p_colaborador_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colaborador não encontrado'; END IF;

  UPDATE public.rh_colaboradores
  SET ativo = v_ativo,
      rh_ativo = v_administrativo,
      pista_ativo_legado = v_pista,
      controla_ponto = v_ponto,
      updated_at = now()
  WHERE id = p_colaborador_id;

  UPDATE public.producao_membros
  SET ativo = v_pista,
      updated_at = now()
  WHERE rh_colaborador_id = p_colaborador_id
    AND ativo IS DISTINCT FROM v_pista;

  IF v_atual.ativo IS DISTINCT FROM v_ativo
     OR v_atual.rh_ativo IS DISTINCT FROM v_administrativo
     OR v_atual.pista_ativo_legado IS DISTINCT FROM v_pista
     OR v_atual.controla_ponto IS DISTINCT FROM v_ponto THEN
    INSERT INTO public.rh_contextos_auditoria (
      colaborador_id,
      ativo_anterior, ativo_novo,
      administrativo_anterior, administrativo_novo,
      pista_anterior, pista_novo,
      ponto_anterior, ponto_novo,
      origem, alterado_por
    ) VALUES (
      p_colaborador_id,
      v_atual.ativo, v_ativo,
      v_atual.rh_ativo, v_administrativo,
      v_atual.pista_ativo_legado, v_pista,
      v_atual.controla_ponto, v_ponto,
      coalesce(nullif(btrim(p_origem), ''), 'interface_rh'), v_user
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_set_colaborador_contextos_v3(uuid, boolean, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_set_colaborador_contextos_v3(uuid, boolean, boolean, boolean, boolean, text) TO authenticated;

COMMIT;
