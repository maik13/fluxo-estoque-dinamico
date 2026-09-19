BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_consumos_tinta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL
    REFERENCES public.producao_ordens_producao(id) ON DELETE CASCADE,
  apontamento_id UUID
    REFERENCES public.producao_apontamentos(id) ON DELETE SET NULL,
  cor TEXT,
  quantidade_ml NUMERIC(12,2) NOT NULL,
  criado_por_id UUID NOT NULL,
  criado_por_nome_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_consumos_tinta_quantidade_positiva CHECK (quantidade_ml > 0),
  CONSTRAINT producao_consumos_tinta_cor_tamanho CHECK (cor IS NULL OR char_length(cor) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_producao_consumos_tinta_op
  ON public.producao_consumos_tinta(ordem_producao_id, created_at);

CREATE INDEX IF NOT EXISTS idx_producao_consumos_tinta_apontamento
  ON public.producao_consumos_tinta(apontamento_id)
  WHERE apontamento_id IS NOT NULL;

ALTER TABLE public.producao_consumos_tinta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.producao_consumos_tinta FROM anon, authenticated;

COMMENT ON TABLE public.producao_consumos_tinta IS
'Registra um ou vários consumos de tinta em mL vinculados à OP de pintura e, quando disponível, ao apontamento que originou o registro.';

CREATE OR REPLACE FUNCTION public.ordem_producao_e_pintura_v1(
  p_ordem_producao_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.producao_ordens_producao op
    WHERE op.id = p_ordem_producao_id
      AND LOWER(CONCAT_WS(' ', op.tarefa_nome_snapshot, op.descricao)) LIKE '%pintura%'
  );
$$;

REVOKE ALL ON FUNCTION public.ordem_producao_e_pintura_v1(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ordem_producao_e_pintura_v1(UUID) TO service_role;

COMMENT ON FUNCTION public.ordem_producao_e_pintura_v1(UUID) IS
'Regra central de detecção de OP de pintura usando tarefa_nome_snapshot + descricao, sem diferenciar maiúsculas/minúsculas.';

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
     OR NOT public.usuario_tem_permissao_producao('lancar') THEN
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
       SELECT 1
       FROM public.producao_apontamentos a
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

CREATE OR REPLACE FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  p_ordem_producao_id UUID,
  p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_pendentes_conferidos INTEGER := 0;
  v_apontamentos_validos INTEGER := 0;
  v_realizado NUMERIC := 0;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para finalizar Ordens de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'A OP não está aberta para finalização';
  END IF;

  IF public.ordem_producao_e_pintura_v1(v_op.id)
     AND NOT EXISTS (
       SELECT 1 FROM public.producao_consumos_tinta c
       WHERE c.ordem_producao_id = v_op.id
         AND c.quantidade_ml > 0
     ) THEN
    RAISE EXCEPTION 'Informe o consumo de tinta em mL antes de concluir esta OP de pintura.';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, campo_alterado, valor_anterior, valor_novo,
    usuario_id, nome_usuario_snapshot, justificativa
  )
  SELECT
    a.id, 'apontamento_conferido_ao_finalizar_op', 'status', a.status, 'conferido',
    v_user, v_nome, 'Conferência automática realizada na finalização da OP'
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id
    AND a.status = 'lancado';

  UPDATE public.producao_apontamentos
  SET status = 'conferido',
      conferido_por_id = v_user,
      conferido_por_nome_snapshot = v_nome,
      conferido_em = NOW(),
      updated_at = NOW()
  WHERE ordem_producao_id = v_op.id
    AND status = 'lancado';

  GET DIAGNOSTICS v_pendentes_conferidos = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE a.status <> 'cancelado'),
    COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0)
  INTO v_apontamentos_validos, v_realizado
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id;

  IF v_apontamentos_validos = 0 THEN
    RAISE EXCEPTION 'A OP não possui apontamentos válidos para finalização';
  END IF;

  IF v_realizado < v_op.quantidade_planejada
     AND BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION
      'JUSTIFICATIVA_PARCIAL: A produção confirmada (%) é menor que a quantidade planejada (%). Informe o motivo para finalizar a OP com saldo parcial',
      v_realizado, v_op.quantidade_planejada;
  END IF;

  UPDATE public.producao_ordens_producao
  SET status = 'concluida',
      data_inicio_real = COALESCE(data_inicio_real, CURRENT_DATE),
      data_fim_real = CURRENT_DATE,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = NOW()
  WHERE id = v_op.id;

  UPDATE public.producao_processos
  SET status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
      data_inicio_real = CASE
        WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE)
        ELSE data_inicio_real
      END,
      updated_at = NOW()
  WHERE id = v_op.processo_id
    AND status = 'planejado';

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa, dados
  ) VALUES (
    v_op.id, 'op_finalizada_com_conferencia', v_op.status, 'concluida',
    v_user, v_nome, NULLIF(BTRIM(p_justificativa), ''),
    jsonb_build_object(
      'apontamentos_conferidos_automaticamente', v_pendentes_conferidos,
      'apontamentos_validos', v_apontamentos_validos,
      'quantidade_planejada', v_op.quantidade_planejada,
      'quantidade_confirmada', v_realizado,
      'versao_rpc', 1
    )
  );

  RETURN jsonb_build_object(
    'ordem_producao_id', v_op.id,
    'apontamentos_conferidos', v_pendentes_conferidos,
    'apontamentos_validos', v_apontamentos_validos,
    'quantidade_planejada', v_op.quantidade_planejada,
    'quantidade_confirmada', v_realizado,
    'status', 'concluida'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(UUID, TEXT)
  TO authenticated, service_role;

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
      v_ordem_producao_id, v_apontamento_id, p_consumos_tinta
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

NOTIFY pgrst, 'reload schema';

COMMIT;
