-- Etapa 1 do cronograma de Produção.
-- Usa producao_processos como fonte única das Etapas; o Gantt é apenas uma visão.

BEGIN;

ALTER TABLE public.producao_processos
  ADD COLUMN IF NOT EXISTS grupo_cronograma TEXT NULL,
  ADD COLUMN IF NOT EXISTS sequencia INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacidade_diaria NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS pessoas_necessarias NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS aceita_producao_proporcional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS producao_processos_projeto_sequencia_idx
  ON public.producao_processos (projeto_id, sequencia, created_at);

CREATE OR REPLACE FUNCTION public.configurar_planejamento_etapa_producao(
  p_processo_id UUID,
  p_data_inicio_prevista DATE DEFAULT NULL,
  p_data_fim_prevista DATE DEFAULT NULL,
  p_grupo_cronograma TEXT DEFAULT NULL,
  p_sequencia INTEGER DEFAULT 0,
  p_capacidade_diaria NUMERIC DEFAULT NULL,
  p_pessoas_necessarias NUMERIC DEFAULT NULL,
  p_aceita_producao_proporcional BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_anterior JSONB;
  v_posterior JSONB;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para configurar o planejamento da etapa';
  END IF;

  IF p_data_inicio_prevista IS NOT NULL
     AND p_data_fim_prevista IS NOT NULL
     AND p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'A data final planejada não pode ser anterior à data inicial';
  END IF;

  IF p_capacidade_diaria IS NOT NULL AND p_capacidade_diaria <= 0 THEN
    RAISE EXCEPTION 'A capacidade diária deve ser maior que zero';
  END IF;

  IF p_pessoas_necessarias IS NOT NULL AND p_pessoas_necessarias < 0 THEN
    RAISE EXCEPTION 'A quantidade de pessoas não pode ser negativa';
  END IF;

  SELECT to_jsonb(p),
         COALESCE(u.raw_user_meta_data->>'name', u.email, 'Usuário')
    INTO v_anterior, v_nome
  FROM public.producao_processos p
  LEFT JOIN auth.users u ON u.id = v_user
  WHERE p.id = p_processo_id
  FOR UPDATE;

  IF v_anterior IS NULL THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  UPDATE public.producao_processos
  SET data_inicio_prevista = p_data_inicio_prevista,
      data_fim_prevista = p_data_fim_prevista,
      grupo_cronograma = NULLIF(btrim(p_grupo_cronograma), ''),
      sequencia = GREATEST(COALESCE(p_sequencia, 0), 0),
      capacidade_diaria = p_capacidade_diaria,
      pessoas_necessarias = p_pessoas_necessarias,
      aceita_producao_proporcional = COALESCE(p_aceita_producao_proporcional, false),
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = now()
  WHERE id = p_processo_id;

  SELECT to_jsonb(p) INTO v_posterior
  FROM public.producao_processos p
  WHERE p.id = p_processo_id;

  INSERT INTO public.producao_processo_eventos (
    processo_id,
    tipo_evento,
    status_anterior,
    novo_status,
    usuario_responsavel_id,
    nome_usuario_snapshot,
    justificativa,
    dados_complementares,
    valores_anteriores,
    valores_posteriores
  )
  SELECT
    p.id,
    'planejamento_atualizado',
    p.status,
    p.status,
    v_user,
    v_nome,
    NULL,
    jsonb_build_object('origem', 'cronograma_producao'),
    v_anterior,
    v_posterior
  FROM public.producao_processos p
  WHERE p.id = p_processo_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.configurar_planejamento_etapa_producao(
  UUID, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configurar_planejamento_etapa_producao(
  UUID, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_gantt_producao()
RETURNS TABLE (
  etapa_id UUID,
  codigo TEXT,
  etapa_nome TEXT,
  projeto_id UUID,
  projeto_nome TEXT,
  cidade TEXT,
  uf TEXT,
  grupo_cronograma TEXT,
  sequencia INTEGER,
  unidade_medida TEXT,
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_realizado NUMERIC,
  status TEXT,
  prioridade TEXT,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  capacidade_diaria NUMERIC,
  pessoas_necessarias NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.codigo,
    p.nome,
    p.projeto_id,
    pr.nome,
    pr.cidade,
    pr.uf,
    p.grupo_cronograma,
    p.sequencia,
    p.unidade_medida,
    p.quantidade_planejada,
    COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0),
    CASE
      WHEN COALESCE(p.quantidade_planejada, 0) <= 0 THEN 0
      ELSE LEAST(100, ROUND((COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0) / p.quantidade_planejada) * 100, 2))
    END,
    p.status,
    p.prioridade,
    p.data_inicio_prevista,
    p.data_fim_prevista,
    p.data_inicio_real,
    p.data_fim_real,
    p.capacidade_diaria,
    p.pessoas_necessarias
  FROM public.producao_processos p
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN public.producao_apontamentos a ON a.processo_id = p.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  GROUP BY p.id, pr.id
  ORDER BY pr.nome, p.sequencia, p.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

COMMIT;
