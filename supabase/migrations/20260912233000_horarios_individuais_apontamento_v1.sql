BEGIN;

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS inicio_individual TIME NULL,
  ADD COLUMN IF NOT EXISTS termino_individual TIME NULL,
  ADD COLUMN IF NOT EXISTS duracao_minutos_snapshot INTEGER NULL
    CHECK (duracao_minutos_snapshot IS NULL OR duracao_minutos_snapshot BETWEEN 1 AND 1440);

CREATE OR REPLACE FUNCTION public.salvar_horarios_membros_apontamento(
  p_apontamento_id UUID,
  p_horarios JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_apontamento public.producao_apontamentos%ROWTYPE;
  v_vinculo public.producao_apontamento_membros%ROWTYPE;
  v_item JSONB;
  v_inicio TIME;
  v_termino TIME;
  v_duracao INTEGER;
  v_improdutivos INTEGER;
  v_personalizado BOOLEAN;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para ajustar horários da equipe';
  END IF;

  SELECT * INTO v_apontamento
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  IF v_apontamento.status <> 'lancado' THEN
    RAISE EXCEPTION 'Somente apontamentos pendentes podem ter horários da equipe ajustados';
  END IF;

  IF p_horarios IS NULL THEN
    p_horarios := '[]'::JSONB;
  END IF;

  IF jsonb_typeof(p_horarios) <> 'array' THEN
    RAISE EXCEPTION 'Horários da equipe em formato inválido';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_horarios)
  LOOP
    IF NULLIF(v_item->>'membro_id', '') IS NULL THEN
      RAISE EXCEPTION 'Membro inválido nos horários personalizados';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.producao_apontamento_membros pam
      WHERE pam.apontamento_id = p_apontamento_id
        AND pam.membro_id = (v_item->>'membro_id')::UUID
    ) THEN
      RAISE EXCEPTION 'O membro informado não pertence a este apontamento';
    END IF;
  END LOOP;

  FOR v_vinculo IN
    SELECT *
    FROM public.producao_apontamento_membros
    WHERE apontamento_id = p_apontamento_id
  LOOP
    v_item := NULL;
    SELECT value INTO v_item
    FROM jsonb_array_elements(p_horarios)
    WHERE value->>'membro_id' = v_vinculo.membro_id::TEXT
    LIMIT 1;

    v_personalizado := v_item IS NOT NULL
      AND NULLIF(v_item->>'inicio', '') IS NOT NULL
      AND NULLIF(v_item->>'termino', '') IS NOT NULL;

    IF v_item IS NOT NULL AND NOT v_personalizado THEN
      RAISE EXCEPTION 'Informe início e término para o horário personalizado do membro %', v_vinculo.nome_snapshot;
    END IF;

    IF v_personalizado THEN
      v_inicio := (v_item->>'inicio')::TIME;
      v_termino := (v_item->>'termino')::TIME;

      IF v_termino <= v_inicio THEN
        RAISE EXCEPTION 'O término individual deve ser maior que o início para %', v_vinculo.nome_snapshot;
      END IF;
      IF v_inicio < v_apontamento.inicio OR v_termino > v_apontamento.termino THEN
        RAISE EXCEPTION 'O horário individual de % deve estar dentro do período geral do apontamento', v_vinculo.nome_snapshot;
      END IF;

      v_duracao := CEIL(EXTRACT(EPOCH FROM (v_termino - v_inicio)) / 60.0)::INTEGER;
    ELSE
      v_inicio := NULL;
      v_termino := NULL;
      v_duracao := v_apontamento.duracao_minutos;
    END IF;

    v_improdutivos := LEAST(COALESCE(v_apontamento.minutos_improdutivos, 0), v_duracao);

    UPDATE public.producao_apontamento_membros
    SET inicio_individual = v_inicio,
        termino_individual = v_termino,
        duracao_minutos_snapshot = v_duracao,
        minutos_produtivos_snapshot = GREATEST(v_duracao - v_improdutivos, 0),
        minutos_improdutivos_snapshot = v_improdutivos
    WHERE id = v_vinculo.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_com_horarios(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_horarios_membros JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.criar_apontamento_producao(
    p_data => p_data,
    p_ordem_producao_id => p_ordem_producao_id,
    p_processo_id => p_processo_id,
    p_projeto_local_id => p_projeto_local_id,
    p_tarefa_id => p_tarefa_id,
    p_local_tipo => p_local_tipo,
    p_quantidade_produzida => p_quantidade_produzida,
    p_inicio => p_inicio,
    p_termino => p_termino,
    p_duracao_minutos => p_duracao_minutos,
    p_minutos_produtivos => p_minutos_produtivos,
    p_minutos_improdutivos => p_minutos_improdutivos,
    p_motivo_improdutivo => p_motivo_improdutivo,
    p_observacoes => p_observacoes,
    p_membros => p_membros
  );

  PERFORM public.salvar_horarios_membros_apontamento(v_id, p_horarios_membros);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_jornada_producao_gerencial(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_membro_id UUID DEFAULT NULL
)
RETURNS TABLE(
  membro_id UUID,
  membro_nome TEXT,
  data DATE,
  jornada_prevista_minutos INTEGER,
  minutos_apontados INTEGER,
  minutos_produtivos INTEGER,
  minutos_improdutivos INTEGER,
  minutos_sem_apontamento INTEGER,
  minutos_extras INTEGER,
  eficiencia_percentual NUMERIC,
  ocupacao_percentual NUMERIC,
  aproveitamento_percentual NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT
      pam.membro_id,
      MAX(pam.nome_snapshot) AS membro_nome,
      a.data,
      MAX(pam.jornada_diaria_minutos_snapshot) AS jornada_prevista_minutos,
      SUM(COALESCE(pam.duracao_minutos_snapshot, a.duracao_minutos))::INTEGER AS minutos_apontados,
      SUM(COALESCE(pam.minutos_produtivos_snapshot, a.minutos_produtivos, a.duracao_minutos))::INTEGER AS minutos_produtivos,
      SUM(COALESCE(pam.minutos_improdutivos_snapshot, a.minutos_improdutivos, 0))::INTEGER AS minutos_improdutivos
    FROM public.producao_apontamento_membros pam
    JOIN public.producao_apontamentos a ON a.id = pam.apontamento_id
    WHERE a.status <> 'cancelado'
      AND (p_data_inicio IS NULL OR a.data >= p_data_inicio)
      AND (p_data_fim IS NULL OR a.data <= p_data_fim)
      AND (p_membro_id IS NULL OR pam.membro_id = p_membro_id)
    GROUP BY pam.membro_id, a.data
  )
  SELECT
    b.membro_id,
    b.membro_nome,
    b.data,
    b.jornada_prevista_minutos,
    b.minutos_apontados,
    b.minutos_produtivos,
    b.minutos_improdutivos,
    CASE WHEN b.jornada_prevista_minutos IS NULL THEN NULL
         ELSE GREATEST(b.jornada_prevista_minutos - b.minutos_apontados, 0) END::INTEGER,
    CASE WHEN b.jornada_prevista_minutos IS NULL THEN NULL
         ELSE GREATEST(b.minutos_apontados - b.jornada_prevista_minutos, 0) END::INTEGER,
    CASE WHEN b.minutos_apontados > 0 THEN ROUND((b.minutos_produtivos::NUMERIC / b.minutos_apontados) * 100, 2) ELSE 0 END,
    CASE WHEN COALESCE(b.jornada_prevista_minutos, 0) > 0 THEN ROUND((b.minutos_apontados::NUMERIC / b.jornada_prevista_minutos) * 100, 2) ELSE NULL END,
    CASE WHEN COALESCE(b.jornada_prevista_minutos, 0) > 0 THEN ROUND((b.minutos_produtivos::NUMERIC / b.jornada_prevista_minutos) * 100, 2) ELSE NULL END
  FROM base b
  ORDER BY b.data DESC, b.membro_nome;
$$;

REVOKE ALL ON FUNCTION public.salvar_horarios_membros_apontamento(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_apontamento_producao_com_horarios(DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME, TIME, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_horarios_membros_apontamento(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_com_horarios(DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME, TIME, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_jornada_producao_gerencial(DATE, DATE, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
