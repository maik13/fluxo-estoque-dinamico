BEGIN;

CREATE OR REPLACE FUNCTION public.rh_sincronizar_registros_appcontrole_v1(
  p_colaborador_id UUID,
  p_registros JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_item JSONB;
  v_status TEXT;
  v_total INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_admin()
    OR public.permissao_individual_efetiva(v_user, 'ponto_gerenciar')
  ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para sincronizar registros de ponto';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.rh_colaboradores c
    WHERE c.id = p_colaborador_id
      AND c.ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou inativo';
  END IF;

  IF p_registros IS NULL OR jsonb_typeof(p_registros) <> 'array' THEN
    RAISE EXCEPTION 'Lista de registros inválida';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_registros)
  LOOP
    IF NULLIF(v_item->>'id', '') IS NULL OR NULLIF(v_item->>'data', '') IS NULL THEN
      CONTINUE;
    END IF;

    v_status := CASE
      WHEN v_item->>'status' IN ('pendente', 'aprovado', 'rejeitado')
        THEN v_item->>'status'
      ELSE 'pendente'
    END;

    INSERT INTO public.rh_registros_ponto (
      colaborador_id,
      data,
      hora_entrada_1,
      hora_saida_1,
      hora_entrada_2,
      hora_saida_2,
      hora_entrada_3,
      hora_saida_3,
      observacao,
      status,
      origem_sistema,
      origem_id,
      importado_em,
      updated_at
    ) VALUES (
      p_colaborador_id,
      (v_item->>'data')::DATE,
      NULLIF(v_item->>'hora_entrada_1', '')::TIME,
      NULLIF(v_item->>'hora_saida_1', '')::TIME,
      NULLIF(v_item->>'hora_entrada_2', '')::TIME,
      NULLIF(v_item->>'hora_saida_2', '')::TIME,
      NULLIF(v_item->>'hora_entrada_3', '')::TIME,
      NULLIF(v_item->>'hora_saida_3', '')::TIME,
      NULLIF(v_item->>'observacao', ''),
      v_status,
      'appcontrole',
      (v_item->>'id')::UUID,
      NOW(),
      NOW()
    )
    ON CONFLICT (colaborador_id, data) DO UPDATE
      SET hora_entrada_1 = EXCLUDED.hora_entrada_1,
          hora_saida_1 = EXCLUDED.hora_saida_1,
          hora_entrada_2 = EXCLUDED.hora_entrada_2,
          hora_saida_2 = EXCLUDED.hora_saida_2,
          hora_entrada_3 = EXCLUDED.hora_entrada_3,
          hora_saida_3 = EXCLUDED.hora_saida_3,
          observacao = EXCLUDED.observacao,
          status = CASE
            WHEN public.rh_registros_ponto.status = 'aprovado'
              THEN public.rh_registros_ponto.status
            ELSE EXCLUDED.status
          END,
          origem_sistema = 'appcontrole',
          origem_id = EXCLUDED.origem_id,
          importado_em = NOW(),
          updated_at = NOW();

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.rh_sincronizar_registros_appcontrole_v1(UUID, JSONB)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rh_sincronizar_registros_appcontrole_v1(UUID, JSONB)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rh_sincronizar_registros_appcontrole_v1(UUID, JSONB) IS
  'Persiste no Fluxo registros oficiais consultados no App Controle, preservando aprovações já realizadas e a origem para auditoria.';

NOTIFY pgrst, 'reload schema';

COMMIT;
