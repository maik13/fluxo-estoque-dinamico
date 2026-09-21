BEGIN;

ALTER TABLE public.producao_consumos_tinta
  ADD COLUMN IF NOT EXISTS quantidade_unitaria_ml NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS quantidade_pecas NUMERIC(12,2);

COMMENT ON COLUMN public.producao_consumos_tinta.quantidade_unitaria_ml IS
'Consumo unitário de tinta informado pelo usuário, em mL por peça.';
COMMENT ON COLUMN public.producao_consumos_tinta.quantidade_pecas IS
'Quantidade de peças produzidas no apontamento usada para calcular o consumo total.';
COMMENT ON COLUMN public.producao_consumos_tinta.quantidade_ml IS
'Consumo total calculado em mL = quantidade_unitaria_ml x quantidade_pecas para lançamentos da regra v2.';

UPDATE public.producao_consumos_tinta c
SET
  quantidade_pecas = a.quantidade_produzida,
  quantidade_unitaria_ml = CASE
    WHEN a.quantidade_produzida > 0
      THEN ROUND(c.quantidade_ml / a.quantidade_produzida, 4)
    ELSE NULL
  END
FROM public.producao_apontamentos a
WHERE c.apontamento_id = a.id
  AND c.quantidade_unitaria_ml IS NULL
  AND a.quantidade_produzida > 0;

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
  v_quantidade_unitaria NUMERIC;
  v_quantidade_pecas NUMERIC;
  v_quantidade_total NUMERIC;
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

  IF p_apontamento_id IS NULL THEN
    RAISE EXCEPTION 'O consumo unitário de tinta exige um apontamento com quantidade de peças produzidas';
  END IF;

  SELECT a.quantidade_produzida
    INTO v_quantidade_pecas
  FROM public.producao_apontamentos a
  WHERE a.id = p_apontamento_id
    AND a.ordem_producao_id = p_ordem_producao_id
    AND a.status <> 'cancelado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O apontamento informado não pertence a esta OP de pintura ou está cancelado';
  END IF;

  IF v_quantidade_pecas IS NULL OR v_quantidade_pecas <= 0 THEN
    RAISE EXCEPTION 'Informe a quantidade de peças produzidas para calcular o consumo total de tinta';
  END IF;

  IF p_consumos IS NULL OR jsonb_typeof(p_consumos) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  IF jsonb_array_length(p_consumos) = 0 THEN
    RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_consumos)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Cada consumo de tinta deve informar o valor unitário por peça';
    END IF;

    BEGIN
      v_quantidade_unitaria := REPLACE(
        BTRIM(
          COALESCE(
            v_item ->> 'quantidade_unitaria_ml',
            v_item ->> 'quantidade_ml',
            ''
          )
        ),
        ',',
        '.'
      )::NUMERIC;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Informe um valor de tinta unitário por peça válido em mL';
    END;

    IF v_quantidade_unitaria IS NULL OR v_quantidade_unitaria <= 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça deve ser maior que zero mL';
    END IF;

    v_cor := NULLIF(BTRIM(COALESCE(v_item ->> 'cor', '')), '');
    IF v_cor IS NOT NULL AND char_length(v_cor) > 120 THEN
      RAISE EXCEPTION 'A identificação da tinta/cor deve ter no máximo 120 caracteres';
    END IF;

    v_quantidade_total := ROUND(v_quantidade_unitaria * v_quantidade_pecas, 2);

    INSERT INTO public.producao_consumos_tinta (
      ordem_producao_id,
      apontamento_id,
      cor,
      quantidade_ml,
      quantidade_unitaria_ml,
      quantidade_pecas,
      criado_por_id,
      criado_por_nome_snapshot
    ) VALUES (
      p_ordem_producao_id,
      p_apontamento_id,
      v_cor,
      v_quantidade_total,
      v_quantidade_unitaria,
      v_quantidade_pecas,
      v_user,
      v_nome
    );

    v_registros := v_registros + 1;
    v_total := v_total + v_quantidade_total;
  END LOOP;

  RETURN jsonb_build_object(
    'ordem_producao_id', p_ordem_producao_id,
    'apontamento_id', p_apontamento_id,
    'registros', v_registros,
    'quantidade_pecas', v_quantidade_pecas,
    'total_ml', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_consumos_tinta_op_v1(UUID, UUID, JSONB)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_consumos_tinta_op_v1(UUID, UUID, JSONB)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME WITHOUT TIME ZONE,
  p_termino TIME WITHOUT TIME ZONE,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_consumos_tinta JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento_id UUID;
  v_e_pintura BOOLEAN := FALSE;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  IF p_ordem_producao_id IS NOT NULL THEN
    v_e_pintura := public.ordem_producao_e_pintura_v1(p_ordem_producao_id);
  END IF;

  IF v_e_pintura THEN
    IF p_quantidade_produzida IS NULL OR p_quantidade_produzida <= 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de peças produzidas para calcular o consumo total de tinta';
    END IF;
    IF jsonb_array_length(p_consumos_tinta) = 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    END IF;
  END IF;

  v_apontamento_id := public.criar_apontamento_producao(
    p_data,
    p_ordem_producao_id,
    p_processo_id,
    p_projeto_local_id,
    p_tarefa_id,
    p_local_tipo,
    p_quantidade_produzida,
    p_inicio,
    p_termino,
    p_duracao_minutos,
    p_minutos_produtivos,
    p_minutos_improdutivos,
    p_motivo_improdutivo,
    p_observacoes,
    p_membros
  );

  IF jsonb_array_length(p_consumos_tinta) > 0 THEN
    PERFORM public.registrar_consumos_tinta_op_v1(
      p_ordem_producao_id,
      v_apontamento_id,
      p_consumos_tinta
    );
  END IF;

  RETURN v_apontamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v1(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  p_jornada_id UUID,
  p_tarefa_id UUID,
  p_quantidade_produzida NUMERIC,
  p_termino TIME WITHOUT TIME ZONE,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_horarios_membros JSONB,
  p_concluir_op BOOLEAN,
  p_motivo_regularizacao TEXT,
  p_justificativa_conclusao TEXT,
  p_consumos_tinta JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem_producao_id UUID;
  v_resultado JSONB;
  v_apontamento_id UUID;
  v_finalizacao JSONB := NULL;
  v_consumo_resultado JSONB := NULL;
  v_e_pintura BOOLEAN := FALSE;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  SELECT ordem_producao_id INTO v_ordem_producao_id
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  v_e_pintura := public.ordem_producao_e_pintura_v1(v_ordem_producao_id);

  IF v_e_pintura THEN
    IF p_quantidade_produzida IS NULL OR p_quantidade_produzida <= 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de peças produzidas para calcular o consumo total de tinta';
    END IF;
    IF jsonb_array_length(p_consumos_tinta) = 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    END IF;
  END IF;

  v_resultado := public.finalizar_jornada_op_v1(
    p_jornada_id => p_jornada_id,
    p_tarefa_id => p_tarefa_id,
    p_quantidade_produzida => p_quantidade_produzida,
    p_termino => p_termino,
    p_minutos_improdutivos => p_minutos_improdutivos,
    p_motivo_improdutivo => p_motivo_improdutivo,
    p_observacoes => p_observacoes,
    p_membros => p_membros,
    p_horarios_membros => p_horarios_membros,
    p_concluir_op => FALSE,
    p_motivo_regularizacao => p_motivo_regularizacao,
    p_justificativa_conclusao => p_justificativa_conclusao
  );

  v_apontamento_id := (v_resultado ->> 'apontamento_id')::UUID;

  IF jsonb_array_length(p_consumos_tinta) > 0 THEN
    v_consumo_resultado := public.registrar_consumos_tinta_op_v1(
      v_ordem_producao_id,
      v_apontamento_id,
      p_consumos_tinta
    );
  END IF;

  IF p_concluir_op THEN
    v_finalizacao := public.finalizar_ordem_producao_com_conferencia_v1(
      v_ordem_producao_id,
      NULLIF(BTRIM(p_justificativa_conclusao), '')
    );
  END IF;

  RETURN v_resultado || jsonb_build_object(
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao,
    'consumo_tinta', v_consumo_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB
) TO authenticated, service_role;

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

  IF v_ordem_producao_id IS NOT NULL
     AND public.ordem_producao_e_pintura_v1(v_ordem_producao_id)
     AND p_quantidade_produzida IS NOT NULL
     AND p_quantidade_produzida > 0 THEN
    UPDATE public.producao_consumos_tinta
    SET
      quantidade_pecas = p_quantidade_produzida,
      quantidade_ml = ROUND(quantidade_unitaria_ml * p_quantidade_produzida, 2)
    WHERE apontamento_id = p_apontamento_id
      AND quantidade_unitaria_ml IS NOT NULL;
  END IF;

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
