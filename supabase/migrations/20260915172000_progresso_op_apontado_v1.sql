-- Progresso operacional da OP deve refletir todo apontamento encerrado e não cancelado.
-- A conferência continua existindo separadamente e as regras de conclusão/validação
-- permanecem usando somente apontamentos conferidos onde já fazem isso.

BEGIN;

CREATE OR REPLACE FUNCTION public.listar_ordens_producao_v2(
  p_processo_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  numero BIGINT,
  processo_id UUID,
  projeto_id UUID,
  processo_codigo TEXT,
  processo_nome TEXT,
  projeto_nome TEXT,
  projeto_cidade TEXT,
  projeto_uf TEXT,
  tarefa_id UUID,
  tarefa_nome_snapshot TEXT,
  local_tipo TEXT,
  descricao TEXT,
  instrucoes TEXT,
  produto_entregavel TEXT,
  unidade_medida TEXT,
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_realizado NUMERIC,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  responsavel_id UUID,
  responsavel_nome_snapshot TEXT,
  equipe_prevista INTEGER,
  prioridade TEXT,
  status TEXT,
  motivo_cancelamento TEXT,
  criado_por_id UUID,
  criado_por_nome_snapshot TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    o.id,
    o.numero,
    o.processo_id,
    o.projeto_id,
    p.codigo,
    p.nome,
    pr.nome,
    pr.cidade,
    pr.uf,
    o.tarefa_id,
    o.tarefa_nome_snapshot,
    o.local_tipo,
    o.descricao,
    o.instrucoes,
    o.produto_entregavel,
    o.unidade_medida,
    o.quantidade_planejada,
    COALESCE(a.apontado, 0),
    CASE
      WHEN o.quantidade_planejada > 0 THEN
        LEAST(100, ROUND((COALESCE(a.apontado, 0) / o.quantidade_planejada) * 100, 2))
      ELSE 0
    END,
    o.data_inicio_prevista,
    o.data_fim_prevista,
    o.data_inicio_real,
    o.data_fim_real,
    o.responsavel_id,
    o.responsavel_nome_snapshot,
    o.equipe_prevista,
    o.prioridade,
    o.status,
    o.motivo_cancelamento,
    o.criado_por_id,
    o.criado_por_nome_snapshot,
    o.created_at,
    o.updated_at
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id = o.processo_id
  JOIN public.producao_projetos pr ON pr.id = o.projeto_id
  LEFT JOIN (
    SELECT
      ordem_producao_id,
      SUM(COALESCE(quantidade_produzida, 0))
        FILTER (WHERE status <> 'cancelado') AS apontado
    FROM public.producao_apontamentos
    WHERE ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ) a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND (p_processo_id IS NULL OR o.processo_id = p_processo_id)
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.numero;
$$;

REVOKE ALL ON FUNCTION public.listar_ordens_producao_v2(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_ordens_producao_v2(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  TO_REGPROCEDURE('public.listar_ordens_producao_v2(uuid,text)') AS rpc_listar_ops,
  (
    SELECT COALESCE(SUM(quantidade_produzida), 0)
    FROM public.producao_apontamentos
    WHERE ordem_producao_id IS NOT NULL
      AND status <> 'cancelado'
  ) AS quantidade_total_apontada_ativa,
  (
    SELECT COALESCE(SUM(quantidade_produzida), 0)
    FROM public.producao_apontamentos
    WHERE ordem_producao_id IS NOT NULL
      AND status = 'conferido'
  ) AS quantidade_total_confirmada;
