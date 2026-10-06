BEGIN;

CREATE OR REPLACE FUNCTION public.listar_planejamento_producao_v2()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH principal_estoque AS (
    SELECT e.id
    FROM public.estoques e
    WHERE e.ativo = TRUE
      AND lower(e.nome) = 'almoxarifado principal'
    ORDER BY e.created_at
    LIMIT 1
  ),
  saldos_oficiais AS (
    SELECT DISTINCT ON (m.item_id)
      m.item_id,
      m.quantidade_atual::numeric AS saldo_atual
    FROM public.movements m
    WHERE
      m.estoque_id = (SELECT id FROM principal_estoque)
      OR m.estoque_id IS NULL
    ORDER BY m.item_id, m.data_hora DESC, m.id DESC
  ),
  demandas_planejamento AS (
    SELECT
      i.id AS planejamento_item_id,
      COALESCE(SUM(
        CASE
          WHEN p.ativo_calculo
            THEN COALESCE((i.demandas ->> p.chave)::numeric, 0)
          ELSE 0
        END
      ), 0) AS demanda_confirmada,
      COALESCE(SUM(COALESCE((i.demandas ->> p.chave)::numeric, 0)), 0) AS demanda_potencial
    FROM public.producao_planejamento_itens i
    CROSS JOIN public.producao_planejamento_projetos p
    WHERE i.ativo = TRUE
    GROUP BY i.id
  ),
  reservas_componentes AS (
    SELECT
      c.item_origem_id,
      SUM(c.quantidade_por_unidade * d.demanda_confirmada) AS quantidade_reservada
    FROM public.producao_planejamento_composicoes c
    JOIN public.producao_planejamento_itens i
      ON i.id = c.planejamento_item_id
     AND i.ativo = TRUE
     AND i.estrategia_atendimento IN ('composicao','transformacao')
    JOIN demandas_planejamento d
      ON d.planejamento_item_id = c.planejamento_item_id
    WHERE c.ativo = TRUE
    GROUP BY c.item_origem_id
  )
  SELECT CASE
    WHEN auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('visualizar')
      THEN jsonb_build_object('projetos','[]'::jsonb,'itens','[]'::jsonb,'fonte',NULL)
    ELSE jsonb_build_object(
      'projetos',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'chave', p.chave,
          'nome', p.nome,
          'ativoCalculo', p.ativo_calculo,
          'ordem', p.ordem,
          'projectGroupId', p.project_group_id
        ) ORDER BY p.ordem, p.nome)
        FROM public.producao_planejamento_projetos p
      ), '[]'::jsonb),
      'itens',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id,
          'fonteLinha', i.fonte_linha,
          'nome', i.nome,
          'codigoProducao', i.codigo_producao,
          'acervoCodigo', i.acervo_codigo_ref,
          'qtdEstoqueReferencia', i.qtd_estoque_referencia,
          'qtdEstoqueAtual',
            CASE
              WHEN i.estrategia_atendimento IN ('composicao','transformacao')
                THEN COALESCE(comp.capacidade_fisica, 0)
              ELSE COALESCE(a.quantidade_estoque, 0)
            END,
          'qtdReservada',
            CASE
              WHEN i.estrategia_atendimento IN ('composicao','transformacao')
                THEN COALESCE(d.demanda_confirmada, 0)
              ELSE COALESCE(r.quantidade_reservada, 0)
            END,
          'qtdDisponivelAtual',
            CASE
              WHEN i.estrategia_atendimento IN ('composicao','transformacao')
                THEN COALESCE(comp.capacidade_livre, 0)
              ELSE GREATEST(COALESCE(a.quantidade_estoque, 0) - COALESCE(r.quantidade_reservada, 0), 0)
            END,
          'qtdDemandaConfirmada', COALESCE(d.demanda_confirmada, 0),
          'qtdDemandaPotencial', COALESCE(d.demanda_potencial, 0),
          'statusPlanilha', i.status_planilha,
          'demandas', i.demandas,
          'acervoId', a.id,
          'acervoNome', a.nome,
          'acervoCategoria', a.categoria,
          'acervoEspecificacoes', a.especificacoes,
          'estrategiaAtendimento', i.estrategia_atendimento,
          'componentesConfigurados', COALESCE(comp.componentes_configurados, 0),
          'componentesResumo', COALESCE(comp.componentes_resumo, '[]'::jsonb)
        ) ORDER BY i.fonte_linha)
        FROM public.producao_planejamento_itens i
        LEFT JOIN public.producao_acervo_cenografico a
          ON a.codigo = i.acervo_codigo_ref
         AND a.ativo = TRUE
        LEFT JOIN (
          SELECT acervo_id, SUM(quantidade) AS quantidade_reservada
          FROM public.producao_acervo_reservas
          WHERE status = 'ativa'
          GROUP BY acervo_id
        ) r ON r.acervo_id = a.id
        LEFT JOIN demandas_planejamento d
          ON d.planejamento_item_id = i.id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS componentes_configurados,
            MIN(
              FLOOR(
                GREATEST(COALESCE(s.saldo_atual, 0), 0)
                / NULLIF(c.quantidade_por_unidade, 0)
              )
            ) AS capacidade_fisica,
            MIN(
              FLOOR(
                GREATEST(
                  COALESCE(s.saldo_atual, 0) - COALESCE(rc.quantidade_reservada, 0),
                  0
                )
                / NULLIF(c.quantidade_por_unidade, 0)
              )
            ) AS capacidade_livre,
            jsonb_agg(
              jsonb_build_object(
                'itemId', c.item_origem_id,
                'codigoBarras', it.codigo_barras,
                'nome', it.nome,
                'quantidadePorUnidade', c.quantidade_por_unidade,
                'saldoFisico', COALESCE(s.saldo_atual, 0),
                'reservadoConfirmado', COALESCE(rc.quantidade_reservada, 0),
                'saldoLivre', GREATEST(COALESCE(s.saldo_atual, 0) - COALESCE(rc.quantidade_reservada, 0), 0)
              )
              ORDER BY it.nome, it.codigo_barras
            ) AS componentes_resumo
          FROM public.producao_planejamento_composicoes c
          JOIN public.items it
            ON it.id = c.item_origem_id
          LEFT JOIN saldos_oficiais s
            ON s.item_id = c.item_origem_id
          LEFT JOIN reservas_componentes rc
            ON rc.item_origem_id = c.item_origem_id
          WHERE c.planejamento_item_id = i.id
            AND c.ativo = TRUE
            AND i.estrategia_atendimento IN ('composicao','transformacao')
        ) comp ON TRUE
        WHERE i.ativo = TRUE
      ), '[]'::jsonb),
      'fonte',
      (
        SELECT jsonb_build_object(
          'chave', f.chave,
          'nome', f.nome,
          'url', f.url,
          'modo', f.modo,
          'status', f.status,
          'ultimaSincronizacao', f.ultima_sincronizacao,
          'ultimoResultado', f.ultimo_resultado
        )
        FROM public.producao_planejamento_fontes f
        WHERE f.chave = 'brusque_2026'
        LIMIT 1
      )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.listar_planejamento_producao_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v2() TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';