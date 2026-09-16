CREATE OR REPLACE FUNCTION public.listar_painel_gerencial_producao_v1()
RETURNS TABLE (
  projeto_id UUID,
  local_utilizacao_id UUID,
  projeto_nome TEXT,
  cliente TEXT,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  percentual_realizado NUMERIC,
  etapas_total INTEGER,
  etapas_concluidas INTEGER,
  ops_total INTEGER,
  ops_concluidas INTEGER,
  horas_homem NUMERIC,
  membros_distintos INTEGER,
  custo_mao_obra NUMERIC,
  custo_mao_obra_incompleto BOOLEAN,
  custo_materiais NUMERIC,
  custo_materiais_incompleto BOOLEAN,
  ultima_atualizacao TIMESTAMPTZ,
  etapas JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_pode_ver BOOLEAN;
  v_pode_ver_custos BOOLEAN;
BEGIN
  v_pode_ver :=
    public.usuario_tem_permissao('producao.bi.visualizar')
    OR public.usuario_tem_permissao('producao.projetos.visualizar')
    OR public.usuario_tem_permissao('gerencial.visualizar');

  IF NOT v_pode_ver THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o Gerencial de Produção';
  END IF;

  v_pode_ver_custos := public.usuario_tem_permissao('producao.bi.custos');

  RETURN QUERY
  WITH apontamentos_validos AS (
    SELECT
      a.id,
      a.projeto_local_id,
      a.ordem_producao_id,
      COALESCE(o.processo_id, a.processo_id) AS processo_id,
      a.quantidade_produzida,
      a.duracao_minutos,
      a.updated_at
    FROM public.producao_apontamentos a
    LEFT JOIN public.producao_ordens_producao o ON o.id = a.ordem_producao_id
    WHERE a.status <> 'cancelado'
  ),
  realizado_etapa AS (
    SELECT
      processo_id,
      COALESCE(SUM(COALESCE(quantidade_produzida, 0)), 0)::numeric AS quantidade_realizada
    FROM apontamentos_validos
    WHERE processo_id IS NOT NULL
    GROUP BY processo_id
  ),
  realizado_op AS (
    SELECT
      ordem_producao_id,
      COALESCE(SUM(COALESCE(quantidade_produzida, 0)), 0)::numeric AS quantidade_realizada
    FROM apontamentos_validos
    WHERE ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ),
  ops_calc AS (
    SELECT
      o.id,
      o.processo_id,
      o.projeto_id,
      o.numero,
      o.tarefa_nome_snapshot,
      o.descricao,
      o.produto_entregavel,
      o.status,
      o.local_tipo,
      o.quantidade_planejada,
      COALESCE(ro.quantidade_realizada, 0)::numeric AS quantidade_realizada,
      CASE
        WHEN COALESCE(o.quantidade_planejada, 0) > 0
          THEN LEAST(100::numeric, ROUND((COALESCE(ro.quantidade_realizada, 0) / o.quantidade_planejada) * 100, 1))
        WHEN o.status = 'concluida' THEN 100::numeric
        ELSE 0::numeric
      END AS percentual_realizado,
      o.data_inicio_prevista,
      o.data_fim_prevista,
      o.updated_at
    FROM public.producao_ordens_producao o
    LEFT JOIN realizado_op ro ON ro.ordem_producao_id = o.id
    WHERE o.status <> 'cancelada'
  ),
  ops_por_etapa AS (
    SELECT
      processo_id,
      COUNT(*)::integer AS ops_total,
      COUNT(*) FILTER (WHERE status = 'concluida')::integer AS ops_concluidas,
      AVG(percentual_realizado)::numeric AS media_percentual_ops,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'numero', numero,
          'atividade', COALESCE(NULLIF(tarefa_nome_snapshot, ''), NULLIF(descricao, ''), NULLIF(produto_entregavel, ''), 'OP ' || numero::text),
          'status', status,
          'local_tipo', local_tipo,
          'quantidade_planejada', quantidade_planejada,
          'quantidade_realizada', quantidade_realizada,
          'percentual_realizado', percentual_realizado,
          'data_inicio_prevista', data_inicio_prevista,
          'data_fim_prevista', data_fim_prevista
        )
        ORDER BY numero
      ) AS ordens,
      MAX(updated_at) AS ultima_atualizacao
    FROM ops_calc
    GROUP BY processo_id
  ),
  etapas_calc AS (
    SELECT
      e.id,
      e.projeto_id,
      e.codigo,
      e.nome,
      e.status,
      e.sequencia,
      e.quantidade_planejada,
      CASE
        WHEN e.status = 'finalizado' THEN 100::numeric
        WHEN COALESCE(e.quantidade_planejada, 0) > 0
          THEN LEAST(100::numeric, ROUND((COALESCE(re.quantidade_realizada, 0) / e.quantidade_planejada) * 100, 1))
        WHEN COALESCE(oe.ops_total, 0) > 0
          THEN ROUND(COALESCE(oe.media_percentual_ops, 0), 1)
        ELSE 0::numeric
      END AS percentual_realizado,
      COALESCE(oe.ops_total, 0)::integer AS ops_total,
      COALESCE(oe.ops_concluidas, 0)::integer AS ops_concluidas,
      COALESCE(oe.ordens, '[]'::jsonb) AS ordens,
      GREATEST(e.updated_at, COALESCE(oe.ultima_atualizacao, e.updated_at)) AS ultima_atualizacao
    FROM public.producao_processos e
    LEFT JOIN realizado_etapa re ON re.processo_id = e.id
    LEFT JOIN ops_por_etapa oe ON oe.processo_id = e.id
    WHERE e.status <> 'cancelado'
  ),
  projetos_etapas AS (
    SELECT
      projeto_id,
      COUNT(*)::integer AS etapas_total,
      COUNT(*) FILTER (WHERE status = 'finalizado')::integer AS etapas_concluidas,
      COALESCE(SUM(ops_total), 0)::integer AS ops_total,
      COALESCE(SUM(ops_concluidas), 0)::integer AS ops_concluidas,
      ROUND(AVG(percentual_realizado), 1)::numeric AS percentual_realizado,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'codigo', codigo,
          'nome', nome,
          'status', status,
          'percentual_realizado', percentual_realizado,
          'ops_total', ops_total,
          'ops_concluidas', ops_concluidas,
          'ordens', ordens
        )
        ORDER BY sequencia, nome
      ) AS etapas,
      MAX(ultima_atualizacao) AS ultima_atualizacao
    FROM etapas_calc
    GROUP BY projeto_id
  ),
  mao_obra AS (
    SELECT
      a.projeto_local_id,
      ROUND(COALESCE(SUM(COALESCE(am.duracao_minutos_snapshot, a.duracao_minutos)), 0) / 60.0, 2)::numeric AS horas_homem,
      COUNT(DISTINCT am.membro_id)::integer AS membros_distintos,
      ROUND(COALESCE(SUM(
        CASE
          WHEN am.valor_hora_snapshot IS NULL THEN 0
          ELSE am.valor_hora_snapshot * COALESCE(am.duracao_minutos_snapshot, a.duracao_minutos) / 60.0
        END
      ), 0), 2)::numeric AS custo_mao_obra,
      COALESCE(BOOL_OR(am.valor_hora_snapshot IS NULL), false) AS custo_incompleto,
      MAX(GREATEST(a.updated_at, am.created_at)) AS ultima_atualizacao
    FROM public.producao_apontamentos a
    JOIN public.producao_apontamento_membros am ON am.apontamento_id = a.id
    WHERE a.status <> 'cancelado'
      AND a.projeto_local_id IS NOT NULL
    GROUP BY a.projeto_local_id
  ),
  materiais AS (
    SELECT
      m.projeto_local_id,
      GREATEST(0::numeric, ROUND(COALESCE(SUM(
        CASE
          WHEN lower(COALESCE(m.tipo, '')) IN ('saida', 'saída') AND i.valor IS NOT NULL
            THEN COALESCE(m.quantidade, 0) * i.valor
          WHEN lower(COALESCE(m.tipo, '')) = 'entrada' AND i.valor IS NOT NULL
            THEN -COALESCE(m.quantidade, 0) * i.valor
          ELSE 0
        END
      ), 0), 2))::numeric AS custo_materiais,
      COALESCE(BOOL_OR(
        lower(COALESCE(m.tipo, '')) IN ('saida', 'saída', 'entrada')
        AND (m.item_id IS NULL OR i.valor IS NULL)
      ), false) AS custo_incompleto,
      MAX(m.created_at) AS ultima_atualizacao
    FROM public.producao_materiais_projeto m
    LEFT JOIN public.items i ON i.id = m.item_id
    WHERE m.projeto_local_id IS NOT NULL
    GROUP BY m.projeto_local_id
  ),
  atualizacoes_apontamentos AS (
    SELECT projeto_local_id, MAX(updated_at) AS ultima_atualizacao
    FROM public.producao_apontamentos
    WHERE projeto_local_id IS NOT NULL
    GROUP BY projeto_local_id
  )
  SELECT
    p.id AS projeto_id,
    p.local_utilizacao_id,
    p.nome AS projeto_nome,
    p.cliente,
    p.data_inicio_prevista,
    p.data_fim_prevista,
    COALESCE(pe.percentual_realizado, 0)::numeric AS percentual_realizado,
    COALESCE(pe.etapas_total, 0)::integer AS etapas_total,
    COALESCE(pe.etapas_concluidas, 0)::integer AS etapas_concluidas,
    COALESCE(pe.ops_total, 0)::integer AS ops_total,
    COALESCE(pe.ops_concluidas, 0)::integer AS ops_concluidas,
    COALESCE(mo.horas_homem, 0)::numeric AS horas_homem,
    COALESCE(mo.membros_distintos, 0)::integer AS membros_distintos,
    CASE WHEN v_pode_ver_custos THEN COALESCE(mo.custo_mao_obra, 0)::numeric ELSE NULL END AS custo_mao_obra,
    CASE WHEN v_pode_ver_custos THEN COALESCE(mo.custo_incompleto, false) ELSE false END AS custo_mao_obra_incompleto,
    CASE WHEN v_pode_ver_custos THEN COALESCE(mat.custo_materiais, 0)::numeric ELSE NULL END AS custo_materiais,
    CASE WHEN v_pode_ver_custos THEN COALESCE(mat.custo_incompleto, false) ELSE false END AS custo_materiais_incompleto,
    GREATEST(
      p.updated_at,
      COALESCE(pe.ultima_atualizacao, p.updated_at),
      COALESCE(mo.ultima_atualizacao, p.updated_at),
      COALESCE(mat.ultima_atualizacao, p.updated_at),
      COALESCE(aa.ultima_atualizacao, p.updated_at)
    ) AS ultima_atualizacao,
    COALESCE(pe.etapas, '[]'::jsonb) AS etapas
  FROM public.producao_projetos p
  LEFT JOIN projetos_etapas pe ON pe.projeto_id = p.id
  LEFT JOIN mao_obra mo ON mo.projeto_local_id = p.local_utilizacao_id
  LEFT JOIN materiais mat ON mat.projeto_local_id = p.local_utilizacao_id
  LEFT JOIN atualizacoes_apontamentos aa ON aa.projeto_local_id = p.local_utilizacao_id
  WHERE p.ativo = true
  ORDER BY p.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_painel_gerencial_producao_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_painel_gerencial_producao_v1() TO authenticated;

NOTIFY pgrst, 'reload schema';