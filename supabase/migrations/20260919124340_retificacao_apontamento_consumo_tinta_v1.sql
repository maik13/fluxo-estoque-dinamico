BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_consumos_tinta_op_v1(
  p_ordem_producao_id UUID,
  p_apontamento_id UUID,
  p_consumos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_item JSONB;
  v_cor TEXT;
  v_quantidade NUMERIC;
  v_registros INTEGER := 0;
  v_total NUMERIC := 0;
BEGIN
  IF v_user IS NULL
     OR NOT (
       public.usuario_tem_permissao_producao('lancar')
       OR public.usuario_tem_permissao_producao('editar_apontamento')
     ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar consumo de tinta';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.producao_ordens_producao
    WHERE id = p_ordem_producao_id
  ) THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF NOT public.ordem_producao_e_pintura_v1(p_ordem_producao_id) THEN
    RAISE EXCEPTION 'Consumo de tinta só pode ser registrado em uma OP identificada como pintura';
  END IF;

  IF p_apontamento_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.producao_apontamentos a
       WHERE a.id = p_apontamento_id
         AND a.ordem_producao_id = p_ordem_producao_id
         AND a.status <> 'cancelado'
     ) THEN
    RAISE EXCEPTION 'O apontamento informado não pertence a esta OP de pintura ou está cancelado';
  END IF;

  IF p_consumos IS NULL OR jsonb_typeof(p_consumos) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  IF jsonb_array_length(p_consumos) = 0 THEN
    RETURN jsonb_build_object(
      'ordem_producao_id', p_ordem_producao_id,
      'apontamento_id', p_apontamento_id,
      'registros', 0,
      'total_ml', 0
    );
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_consumos)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada consumo de tinta deve ser um objeto com quantidade_ml';
    END IF;

    BEGIN
      v_quantidade := REPLACE(BTRIM(COALESCE(v_item ->> 'quantidade_ml', '')), ',', '.')::NUMERIC;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Informe uma quantidade de tinta válida em mL';
    END;

    IF v_quantidade IS NULL OR v_quantidade <= 0 THEN
      RAISE EXCEPTION 'A quantidade de tinta deve ser maior que zero mL';
    END IF;

    v_cor := NULLIF(BTRIM(COALESCE(v_item ->> 'cor', '')), '');
    IF v_cor IS NOT NULL AND char_length(v_cor) > 120 THEN
      RAISE EXCEPTION 'A identificação da tinta/cor deve ter no máximo 120 caracteres';
    END IF;

    INSERT INTO public.producao_consumos_tinta (
      ordem_producao_id, apontamento_id, cor, quantidade_ml,
      criado_por_id, criado_por_nome_snapshot
    ) VALUES (
      p_ordem_producao_id, p_apontamento_id, v_cor, v_quantidade,
      v_user, v_nome
    );

    v_registros := v_registros + 1;
    v_total := v_total + v_quantidade;
  END LOOP;

  RETURN jsonb_build_object(
    'ordem_producao_id', p_ordem_producao_id,
    'apontamento_id', p_apontamento_id,
    'registros', v_registros,
    'total_ml', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_consumos_tinta_op_v1(UUID, UUID, JSONB)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_consumos_tinta_op_v1(UUID, UUID, JSONB)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v1(
  p_apontamento_id UUID,
  p_data DATE,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_minutos_improdutivos INTEGER DEFAULT 0,
  p_motivo_improdutivo TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_membros UUID[] DEFAULT ARRAY[]::UUID[],
  p_horarios_membros JSONB DEFAULT '[]'::JSONB,
  p_motivo_retificacao TEXT DEFAULT NULL,
  p_consumos_tinta JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resultado JSONB;
  v_ordem_producao_id UUID;
  v_consumo_resultado JSONB := NULL;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  SELECT ordem_producao_id
    INTO v_ordem_producao_id
    FROM public.producao_apontamentos
   WHERE id = p_apontamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  v_resultado := public.retificar_apontamento_producao_v2(
    p_apontamento_id,
    p_data,
    p_quantidade_produzida,
    p_inicio,
    p_termino,
    p_minutos_improdutivos,
    p_motivo_improdutivo,
    p_observacoes,
    p_membros,
    p_horarios_membros,
    p_motivo_retificacao
  );

  IF jsonb_array_length(p_consumos_tinta) > 0 THEN
    IF v_ordem_producao_id IS NULL THEN
      RAISE EXCEPTION 'Consumo de tinta exige apontamento vinculado a uma OP';
    END IF;

    v_consumo_resultado := public.registrar_consumos_tinta_op_v1(
      v_ordem_producao_id,
      p_apontamento_id,
      p_consumos_tinta
    );
  END IF;

  RETURN v_resultado || jsonb_build_object(
    'consumo_tinta', v_consumo_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v1(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT, JSONB
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v1(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT, JSONB
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
