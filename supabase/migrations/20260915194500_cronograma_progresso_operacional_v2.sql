-- CORREÇÃO DO CRONOGRAMA: usar a mesma fonte de progresso operacional da OP.
-- Regra:
--   progresso operacional = apontamentos encerrados não cancelados
--   conferência = validação separada
-- Não altera, cria, conclui ou cancela OPs/apontamentos.
-- Apenas corrige as funções de leitura do Gantt e Plano Diário.

BEGIN;

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
  data_inicio_desejada DATE,
  data_limite DATE,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  capacidade_diaria NUMERIC,
  pessoas_necessarias NUMERIC,
  alocacoes JSONB,
  ordens JSONB
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
    COALESCE(r.realizado, 0),
    CASE
      WHEN COALESCE(p.quantidade_planejada, 0) <= 0 THEN 0
      ELSE LEAST(100, ROUND((COALESCE(r.realizado, 0) / p.quantidade_planejada) * 100, 2))
    END,
    p.status,
    p.prioridade,
    p.data_inicio_desejada,
    p.data_limite,
    p.data_inicio_prevista,
    p.data_fim_prevista,
    COALESCE(r.inicio_real, p.data_inicio_real),
    CASE
      WHEN p.status IN ('finalizado', 'cancelado') THEN COALESCE(r.fim_real, r.inicio_real, p.data_fim_real)
      ELSE p.data_fim_real
    END,
    p.capacidade_diaria,
    p.pessoas_necessarias,
    COALESCE(al.alocacoes, '[]'::jsonb),
    COALESCE(ops.ordens, '[]'::jsonb)
  FROM public.producao_processos p
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT
      COALESCE(o.processo_id, a.processo_id) AS processo_id,
      COALESCE(SUM(COALESCE(a.quantidade_produzida, 0)) FILTER (WHERE a.status <> 'cancelado'), 0) AS realizado,
      MIN(a.data) FILTER (WHERE a.status <> 'cancelado') AS inicio_real,
      MAX(a.data) FILTER (WHERE a.status <> 'cancelado') AS fim_real
    FROM public.producao_apontamentos a
    LEFT JOIN public.producao_ordens_producao o ON o.id = a.ordem_producao_id
    WHERE COALESCE(o.processo_id, a.processo_id) IS NOT NULL
    GROUP BY COALESCE(o.processo_id, a.processo_id)
  ) r ON r.processo_id = p.id
  LEFT JOIN (
    SELECT
      processo_id,
      jsonb_agg(jsonb_build_object(
        'data', data,
        'quantidade_planejada', quantidade_planejada,
        'pessoas_planejadas', pessoas_planejadas
      ) ORDER BY data) AS alocacoes
    FROM public.producao_alocacoes_diarias
    GROUP BY processo_id
  ) al ON al.processo_id = p.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'id', x.id,
      'numero', x.numero,
      'status', x.status,
      'local_tipo', x.local_tipo,
      'quantidade_planejada', x.quantidade_planejada,
      'quantidade_realizada', x.quantidade_realizada,
      'percentual_realizado', x.percentual_realizado,
      'data_inicio_prevista', x.data_inicio_prevista,
      'data_fim_prevista', x.data_fim_prevista,
      'data_inicio_real', x.data_inicio_real,
      'data_fim_real', x.data_fim_real,
      'responsavel_nome', x.responsavel_nome_snapshot
    ) ORDER BY x.numero) AS ordens
    FROM (
      SELECT
        o.*,
        COALESCE(ap.realizado, 0) AS quantidade_realizada,
        CASE
          WHEN o.quantidade_planejada > 0 THEN LEAST(100, ROUND((COALESCE(ap.realizado, 0) / o.quantidade_planejada) * 100, 2))
          ELSE 0
        END AS percentual_realizado
      FROM public.producao_ordens_producao o
      LEFT JOIN (
        SELECT
          ordem_producao_id,
          SUM(COALESCE(quantidade_produzida, 0)) AS realizado
        FROM public.producao_apontamentos
        WHERE status <> 'cancelado'
          AND ordem_producao_id IS NOT NULL
        GROUP BY ordem_producao_id
      ) ap ON ap.ordem_producao_id = o.id
      WHERE o.processo_id = p.id
    ) x
  ) ops ON TRUE
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome, p.sequencia, p.created_at;
$$;

REVOKE ALL ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_plano_diario_producao(
  p_data_inicio DATE,
  p_dias INTEGER DEFAULT 60
)
RETURNS TABLE (
  etapa_id UUID,
  codigo TEXT,
  etapa_nome TEXT,
  projeto_id UUID,
  projeto_nome TEXT,
  grupo_cronograma TEXT,
  unidade_medida TEXT,
  data DATE,
  quantidade_planejada NUMERIC,
  pessoas_planejadas NUMERIC,
  quantidade_realizada NUMERIC,
  status TEXT
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
    p.grupo_cronograma,
    p.unidade_medida,
    a.data,
    a.quantidade_planejada,
    a.pessoas_planejadas,
    COALESCE(r.quantidade_realizada, 0),
    p.status
  FROM public.producao_alocacoes_diarias a
  JOIN public.producao_processos p ON p.id = a.processo_id
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT
      COALESCE(o.processo_id, ap.processo_id) AS processo_id,
      ap.data,
      SUM(COALESCE(ap.quantidade_produzida, 0)) AS quantidade_realizada
    FROM public.producao_apontamentos ap
    LEFT JOIN public.producao_ordens_producao o ON o.id = ap.ordem_producao_id
    WHERE ap.status <> 'cancelado'
      AND COALESCE(o.processo_id, ap.processo_id) IS NOT NULL
    GROUP BY COALESCE(o.processo_id, ap.processo_id), ap.data
  ) r ON r.processo_id = a.processo_id AND r.data = a.data
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND a.data >= p_data_inicio
    AND a.data < p_data_inicio + LEAST(GREATEST(COALESCE(p_dias, 60), 1), 180)
  ORDER BY pr.nome, p.sequencia, a.data;
$$;

REVOKE ALL ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
