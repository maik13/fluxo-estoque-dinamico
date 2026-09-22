BEGIN;

CREATE OR REPLACE FUNCTION public.validar_demao_pintura_lote_v1(
  p_ordem_producao_id UUID,
  p_demao_numero INTEGER,
  p_quantidade NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_planejada NUMERIC;
  v_total_demao NUMERIC := 0;
  v_maior_demao INTEGER := 0;
BEGIN
  IF NOT public.ordem_producao_e_pintura_v1(p_ordem_producao_id) THEN
    RETURN;
  END IF;

  IF p_demao_numero IS NULL OR p_demao_numero <= 0 THEN
    RAISE EXCEPTION 'Selecione a demão deste apontamento';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Informe a quantidade de peças pintadas nesta demão';
  END IF;

  SELECT quantidade_planejada
    INTO v_planejada
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id;

  IF v_planejada IS NULL OR v_planejada <= 0 THEN
    RAISE EXCEPTION 'A OP não possui quantidade planejada válida';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(a.quantidade_produzida,0)),0),
    COALESCE(MAX(a.demao_numero),0)
  INTO v_total_demao, v_maior_demao
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = p_ordem_producao_id
    AND a.status <> 'cancelado'
    AND a.demao_numero = p_demao_numero;

  IF p_demao_numero > GREATEST(v_maior_demao + 1, 1) THEN
    -- v_maior_demao acima é somente da demão escolhida; recalcula globalmente.
    SELECT COALESCE(MAX(a.demao_numero),0)
      INTO v_maior_demao
    FROM public.producao_apontamentos a
    WHERE a.ordem_producao_id = p_ordem_producao_id
      AND a.status <> 'cancelado'
      AND a.demao_numero IS NOT NULL;

    IF p_demao_numero > v_maior_demao + 1 THEN
      RAISE EXCEPTION
        'Não é possível pular demãos. A maior demão registrada é a %ª',
        v_maior_demao;
    END IF;
  END IF;

  IF v_total_demao + p_quantidade > v_planejada THEN
    RAISE EXCEPTION
      'A %ª demão ultrapassa a quantidade planejada da OP. Já apontado: %; saldo desta demão: %',
      p_demao_numero,
      v_total_demao,
      GREATEST(v_planejada - v_total_demao,0);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_demao_pintura_lote_v1(UUID, INTEGER, NUMERIC)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_demao_pintura_lote_v1(UUID, INTEGER, NUMERIC)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
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
  p_consumos_tinta JSONB,
  p_demao_numero INTEGER
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
    PERFORM public.validar_demao_pintura_lote_v1(
      p_ordem_producao_id,
      p_demao_numero,
      p_quantidade_produzida
    );

    IF jsonb_array_length(p_consumos_tinta) = 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    END IF;
  ELSE
    p_demao_numero := NULL;
  END IF;

  v_apontamento_id := public.criar_apontamento_producao(
    p_data, p_ordem_producao_id, p_processo_id, p_projeto_local_id, p_tarefa_id,
    p_local_tipo, p_quantidade_produzida, p_inicio, p_termino, p_duracao_minutos,
    p_minutos_produtivos, p_minutos_improdutivos, p_motivo_improdutivo,
    p_observacoes, p_membros
  );

  IF v_e_pintura THEN
    UPDATE public.producao_apontamentos
    SET demao_numero = p_demao_numero
    WHERE id = v_apontamento_id;

    PERFORM public.registrar_consumos_tinta_op_v1(
      p_ordem_producao_id, v_apontamento_id, p_consumos_tinta
    );
  END IF;

  RETURN v_apontamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB, INTEGER
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_com_consumos_v2(
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
  p_consumos_tinta JSONB,
  p_demao_numero INTEGER
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
  SELECT ordem_producao_id INTO v_ordem_producao_id
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  v_e_pintura := public.ordem_producao_e_pintura_v1(v_ordem_producao_id);

  IF v_e_pintura THEN
    PERFORM public.validar_demao_pintura_lote_v1(
      v_ordem_producao_id,
      p_demao_numero,
      p_quantidade_produzida
    );

    IF p_consumos_tinta IS NULL
       OR jsonb_typeof(p_consumos_tinta) <> 'array'
       OR jsonb_array_length(p_consumos_tinta) = 0 THEN
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

  IF v_e_pintura THEN
    UPDATE public.producao_apontamentos
    SET demao_numero = p_demao_numero
    WHERE id = v_apontamento_id;

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
    'demao_numero', CASE WHEN v_e_pintura THEN p_demao_numero ELSE NULL END,
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao,
    'consumo_tinta', v_consumo_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_jornada_op_com_consumos_v2(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_com_consumos_v2(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB, INTEGER
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
