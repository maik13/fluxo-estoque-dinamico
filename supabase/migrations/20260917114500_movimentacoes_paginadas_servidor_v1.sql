CREATE OR REPLACE FUNCTION public.listar_movimentacoes_paginadas_v1(
  p_estoque_id uuid DEFAULT NULL,
  p_incluir_sem_estoque boolean DEFAULT false,
  p_pagina integer DEFAULT 1,
  p_limite integer DEFAULT 20,
  p_busca text DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_tipo_operacao_id uuid DEFAULT NULL,
  p_visualizacao text DEFAULT 'todas',
  p_local_utilizacao_id uuid DEFAULT NULL,
  p_tipo_item text DEFAULT NULL,
  p_subcategoria_ids text[] DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    GREATEST(COALESCE(p_pagina, 1), 1) AS pagina,
    LEAST(GREATEST(COALESCE(p_limite, 20), 1), 1000) AS limite,
    NULLIF(BTRIM(p_busca), '') AS busca,
    NULLIF(BTRIM(p_tipo), '') AS tipo,
    NULLIF(BTRIM(p_visualizacao), '') AS visualizacao,
    NULLIF(BTRIM(p_tipo_item), '') AS tipo_item
),
base AS (
  SELECT
    m.id, m.item_id, m.tipo, m.quantidade, m.quantidade_anterior, m.quantidade_atual,
    m.user_id, m.observacoes, m.data_hora, m.local_utilizacao_id,
    l.nome AS local_utilizacao_nome, m.solicitacao_id, s.solicitante_nome,
    s.tipo_operacao AS solicitacao_tipo_operacao, m.destinatario, m.estoque_id,
    m.tipo_operacao_id, t.nome AS tipo_operacao_nome, m.item_snapshot,
    pr.nome AS responsavel_nome,
    (m.tipo = 'ENTRADA' AND (lower(COALESCE(s.tipo_operacao, '')) IN ('devolucao', 'devolucao_estoque') OR lower(COALESCE(m.observacoes, '')) LIKE '%devolu%')) AS eh_devolucao,
    (m.tipo = 'ENTRADA' AND (lower(COALESCE(t.nome, '')) LIKE '%acerto%' OR lower(COALESCE(m.observacoes, '')) LIKE '%acerto%')) AS eh_entrada_acerto,
    (m.tipo = 'SAIDA' AND (lower(COALESCE(t.nome, '')) LIKE '%acerto%' OR lower(COALESCE(m.observacoes, '')) LIKE '%acerto%' OR lower(COALESCE(m.destinatario, '')) LIKE '%acerto%')) AS eh_saida_acerto
  FROM public.movements m
  LEFT JOIN public.locais_utilizacao l ON l.id = m.local_utilizacao_id
  LEFT JOIN public.solicitacoes s ON s.id = m.solicitacao_id
  LEFT JOIN public.tipos_operacao t ON t.id = m.tipo_operacao_id
  LEFT JOIN public.profiles pr ON pr.user_id = m.user_id
  WHERE auth.uid() IS NOT NULL
    AND (p_estoque_id IS NULL OR m.estoque_id = p_estoque_id OR (p_incluir_sem_estoque AND m.estoque_id IS NULL))
),
filtrado AS (
  SELECT b.*
  FROM base b CROSS JOIN params p
  WHERE
    (p.busca IS NULL OR (CASE WHEN p.busca ~ '^[0-9]+$' THEN COALESCE(b.item_snapshot->>'codigoBarras', b.item_snapshot->>'codigo_barras', '') = p.busca ELSE COALESCE(b.item_snapshot->>'nome', '') ILIKE '%' || p.busca || '%' OR COALESCE(b.observacoes, '') ILIKE '%' || p.busca || '%' OR COALESCE(b.destinatario, '') ILIKE '%' || p.busca || '%' OR COALESCE(b.responsavel_nome, '') ILIKE '%' || p.busca || '%' OR COALESCE(b.solicitante_nome, '') ILIKE '%' || p.busca || '%' END))
    AND (p.visualizacao IS NULL OR p.visualizacao = 'todas' OR (p.visualizacao = 'saidas' AND b.tipo = 'SAIDA' AND NOT b.eh_saida_acerto) OR (p.visualizacao = 'devolucoes' AND b.eh_devolucao) OR (p.visualizacao = 'pendentes' AND b.tipo = 'SAIDA' AND NOT b.eh_saida_acerto))
    AND (p.tipo IS NULL OR p.tipo = 'todas' OR (p.tipo = 'ENTRADA' AND b.tipo = 'ENTRADA' AND NOT b.eh_devolucao AND NOT b.eh_entrada_acerto) OR (p.tipo = 'ENTRADA_ACERTO' AND b.eh_entrada_acerto) OR (p.tipo = 'SAIDA' AND b.tipo = 'SAIDA' AND NOT b.eh_saida_acerto) OR (p.tipo = 'SAIDA_ACERTO' AND b.eh_saida_acerto) OR (p.tipo = 'DEVOLUCAO' AND b.eh_devolucao) OR (p.tipo = 'CADASTRO' AND b.tipo = 'CADASTRO'))
    AND (p_tipo_operacao_id IS NULL OR b.tipo_operacao_id = p_tipo_operacao_id)
    AND (p_local_utilizacao_id IS NULL OR b.local_utilizacao_id = p_local_utilizacao_id)
    AND (p.tipo_item IS NULL OR COALESCE(b.item_snapshot->>'tipoItem', b.item_snapshot->>'tipo_item', '') = p.tipo_item)
    AND (p_subcategoria_ids IS NULL OR cardinality(p_subcategoria_ids) = 0 OR COALESCE(b.item_snapshot->>'subcategoriaId', b.item_snapshot->>'subcategoria_id', '') = ANY(p_subcategoria_ids))
    AND (p_data_inicio IS NULL OR b.data_hora >= p_data_inicio)
    AND (p_data_fim IS NULL OR b.data_hora <= p_data_fim)
),
paginado AS (
  SELECT f.* FROM filtrado f CROSS JOIN params p
  ORDER BY f.data_hora DESC, f.id DESC
  LIMIT (SELECT limite FROM params)
  OFFSET ((SELECT pagina FROM params) - 1) * (SELECT limite FROM params)
),
stats AS (
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE b.data_hora >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'))::bigint AS hoje,
    COUNT(*) FILTER (WHERE b.tipo = 'ENTRADA' AND NOT b.eh_devolucao AND NOT b.eh_entrada_acerto)::bigint AS entradas,
    COUNT(*) FILTER (WHERE b.tipo = 'SAIDA' AND NOT b.eh_saida_acerto)::bigint AS saidas,
    COUNT(*) FILTER (WHERE b.eh_devolucao)::bigint AS devolucoes
  FROM base b
)
SELECT jsonb_build_object(
  'totalFiltrado', (SELECT COUNT(*) FROM filtrado),
  'pagina', (SELECT pagina FROM params),
  'limite', (SELECT limite FROM params),
  'stats', jsonb_build_object('total', COALESCE((SELECT total FROM stats), 0), 'hoje', COALESCE((SELECT hoje FROM stats), 0), 'entradas', COALESCE((SELECT entradas FROM stats), 0), 'saidas', COALESCE((SELECT saidas FROM stats), 0), 'devolucoes', COALESCE((SELECT devolucoes FROM stats), 0)),
  'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'itemId', p.item_id, 'tipo', p.tipo, 'quantidade', p.quantidade,
    'quantidadeAnterior', p.quantidade_anterior, 'quantidadeAtual', p.quantidade_atual,
    'userId', p.user_id, 'responsavelNome', p.responsavel_nome, 'observacoes', p.observacoes,
    'dataHora', p.data_hora, 'localUtilizacaoId', p.local_utilizacao_id,
    'localUtilizacaoNome', p.local_utilizacao_nome, 'solicitacaoId', p.solicitacao_id,
    'solicitanteNome', p.solicitante_nome, 'solicitacaoTipoOperacao', p.solicitacao_tipo_operacao,
    'destinatario', p.destinatario, 'estoqueId', p.estoque_id,
    'tipoOperacaoId', p.tipo_operacao_id, 'tipoOperacaoNome', p.tipo_operacao_nome,
    'itemSnapshot', p.item_snapshot, 'ehDevolucao', p.eh_devolucao,
    'ehEntradaAcerto', p.eh_entrada_acerto, 'ehSaidaAcerto', p.eh_saida_acerto
  ) ORDER BY p.data_hora DESC, p.id DESC) FROM paginado p), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.listar_movimentacoes_paginadas_v1(uuid,boolean,integer,integer,text,text,uuid,text,uuid,text,text[],timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_movimentacoes_paginadas_v1(uuid,boolean,integer,integer,text,text,uuid,text,uuid,text,text[],timestamptz,timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
