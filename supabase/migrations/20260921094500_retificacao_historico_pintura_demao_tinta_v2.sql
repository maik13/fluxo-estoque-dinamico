BEGIN;

CREATE OR REPLACE FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v2(
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
  p_consumos_tinta JSONB DEFAULT '[]'::JSONB,
  p_demao_numero INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_ordem_producao_id UUID;
  v_demao_anterior INTEGER;
  v_e_pintura BOOLEAN := FALSE;
  v_resultado JSONB;
BEGIN
  SELECT a.ordem_producao_id, a.demao_numero
    INTO v_ordem_producao_id, v_demao_anterior
  FROM public.producao_apontamentos a
  WHERE a.id = p_apontamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  IF v_ordem_producao_id IS NOT NULL THEN
    v_e_pintura := public.ordem_producao_e_pintura_v1(v_ordem_producao_id);
  END IF;

  IF v_e_pintura THEN
    IF p_demao_numero IS NULL OR p_demao_numero <= 0 THEN
      RAISE EXCEPTION 'Informe a demão real deste apontamento de pintura';
    END IF;
  ELSE
    p_demao_numero := NULL;
  END IF;

  v_resultado := public.retificar_apontamento_producao_com_consumos_tinta_v1(
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
    p_motivo_retificacao,
    p_consumos_tinta
  );

  IF v_e_pintura AND v_demao_anterior IS DISTINCT FROM p_demao_numero THEN
    v_nome := public.nome_usuario_producao(v_user);

    UPDATE public.producao_apontamentos
    SET
      demao_numero = p_demao_numero,
      ultima_edicao_por_id = v_user,
      ultima_edicao_por_nome_snapshot = v_nome,
      ultima_edicao_em = NOW(),
      updated_at = NOW()
    WHERE id = p_apontamento_id;

    INSERT INTO public.producao_apontamento_eventos (
      apontamento_id,
      evento,
      campo_alterado,
      valor_anterior,
      valor_novo,
      usuario_id,
      nome_usuario_snapshot,
      justificativa
    ) VALUES (
      p_apontamento_id,
      'retificacao_demao_pintura',
      'demao_numero',
      CASE WHEN v_demao_anterior IS NULL THEN NULL ELSE v_demao_anterior::TEXT END,
      p_demao_numero::TEXT,
      v_user,
      v_nome,
      NULLIF(BTRIM(p_motivo_retificacao), '')
    );
  END IF;

  RETURN v_resultado || jsonb_build_object(
    'demao_anterior', v_demao_anterior,
    'demao_numero', CASE WHEN v_e_pintura THEN p_demao_numero ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v2(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT, JSONB, INTEGER
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.retificar_apontamento_producao_com_consumos_tinta_v2(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT, JSONB, INTEGER
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;