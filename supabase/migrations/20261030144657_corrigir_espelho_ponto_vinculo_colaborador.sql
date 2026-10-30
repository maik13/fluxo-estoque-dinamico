-- O aparelho consulta o ponto pelo colaborador vinculado ao auth.uid(), mas o
-- espelho administrativo usava SELECT direto pelo id escolhido no cadastro.
-- Esta RPC aplica a mesma identidade canônica, preserva RLS para o restante da
-- aplicação e só permite leitura a administradores/usuários autorizados.
CREATE OR REPLACE FUNCTION public.rh_get_espelho_ponto_admin_v1(
  p_colaborador_id uuid,
  p_mes date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inicio date;
  v_fim date;
  v_selected public.rh_colaboradores%ROWTYPE;
  v_resolved_id uuid;
  v_candidate_id uuid;
  v_candidate_count integer := 0;
  v_entries jsonb;
  v_resolution text := 'selected';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user_id, 'ponto_visualizar')
    OR public.permissao_individual_efetiva(v_user_id, 'ponto_gerenciar')
    OR public.permissao_individual_efetiva(v_user_id, 'ponto_aprovar')
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para consultar o espelho de ponto';
  END IF;

  SELECT c.*
    INTO v_selected
  FROM public.rh_colaboradores c
  WHERE c.id = p_colaborador_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  v_inicio := date_trunc('month', COALESCE(p_mes, current_date))::date;
  v_fim := (v_inicio + interval '1 month - 1 day')::date;
  v_resolved_id := v_selected.id;

  -- Só procura o cadastro canônico quando o selecionado não tem login e não
  -- possui batidas no mês. Assim dois trabalhadores homônimos válidos nunca
  -- são reunidos automaticamente.
  IF v_selected.user_id IS NULL AND NOT EXISTS (
    SELECT 1
    FROM public.rh_registros_ponto r
    WHERE r.colaborador_id = v_selected.id
      AND r.data BETWEEN v_inicio AND v_fim
  ) THEN
    IF COALESCE(btrim(v_selected.email), '') <> '' THEN
      SELECT count(*), (array_agg(c.id ORDER BY c.id))[1]
        INTO v_candidate_count, v_candidate_id
      FROM public.rh_colaboradores c
      WHERE c.id <> v_selected.id
        AND c.user_id IS NOT NULL
        AND c.ativo = true
        AND c.controla_ponto = true
        AND lower(btrim(COALESCE(c.email, ''))) = lower(btrim(v_selected.email))
        AND EXISTS (
          SELECT 1 FROM public.rh_registros_ponto r
          WHERE r.colaborador_id = c.id
            AND r.data BETWEEN v_inicio AND v_fim
        );

      IF v_candidate_count = 1 THEN
        v_resolved_id := v_candidate_id;
        v_resolution := 'linked_email';
      END IF;
    END IF;

    IF v_resolved_id = v_selected.id THEN
      SELECT count(*), (array_agg(c.id ORDER BY c.id))[1]
        INTO v_candidate_count, v_candidate_id
      FROM public.rh_colaboradores c
      WHERE c.id <> v_selected.id
        AND c.user_id IS NOT NULL
        AND c.ativo = true
        AND c.controla_ponto = true
        AND lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g')) =
            lower(regexp_replace(btrim(v_selected.nome), '\s+', ' ', 'g'))
        AND EXISTS (
          SELECT 1 FROM public.rh_registros_ponto r
          WHERE r.colaborador_id = c.id
            AND r.data BETWEEN v_inicio AND v_fim
        );

      IF v_candidate_count = 1 THEN
        v_resolved_id := v_candidate_id;
        v_resolution := 'linked_name';
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.data), '[]'::jsonb)
    INTO v_entries
  FROM (
    SELECT r.id, r.colaborador_id, r.data,
           r.hora_entrada_1, r.hora_saida_1,
           r.hora_entrada_2, r.hora_saida_2,
           r.hora_entrada_3, r.hora_saida_3,
           r.observacao, r.status
    FROM public.rh_registros_ponto r
    WHERE r.colaborador_id = v_resolved_id
      AND r.data BETWEEN v_inicio AND v_fim
  ) x;

  RETURN jsonb_build_object(
    'selected_colaborador_id', v_selected.id,
    'resolved_colaborador_id', v_resolved_id,
    'resolution', v_resolution,
    'entries', v_entries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rh_get_espelho_ponto_admin_v1(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_get_espelho_ponto_admin_v1(uuid, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
