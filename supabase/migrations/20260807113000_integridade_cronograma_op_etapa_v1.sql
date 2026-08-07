-- Corrige a fonte de verdade do cronograma e bloqueia novas divergências
-- entre Projeto -> Etapa -> OP -> Apontamentos.
--
-- Problemas corrigidos:
-- 1) OP podia estar 100% enquanto a Etapa aparecia 0% no Gantt;
-- 2) Etapa finalizada podia usar a data do clique de finalização em vez das
--    datas reais dos apontamentos/OPs;
-- 3) apontamentos vinculados a OP podiam carregar processo_id legado/nulo;
-- 4) uma OP não possuía proteção de banco contra troca de Etapa/Projeto.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Repara os apontamentos existentes.
--    O trigger legado que recalcula status da OP é temporariamente suspenso
--    apenas durante o backfill para não reabrir uma OP concluída parcialmente.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.producao_apontamentos'::regclass
      AND tgname = 'trg_apontamento_atualiza_ordem'
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.producao_apontamentos DISABLE TRIGGER trg_apontamento_atualiza_ordem';
  END IF;
END $$;

UPDATE public.producao_apontamentos a
SET processo_id = o.processo_id,
    projeto_local_id = NULL,
    local_tipo = o.local_tipo,
    updated_at = NOW()
FROM public.producao_ordens_producao o
WHERE a.ordem_producao_id = o.id
  AND (
    a.processo_id IS DISTINCT FROM o.processo_id
    OR a.projeto_local_id IS NOT NULL
    OR a.local_tipo IS DISTINCT FROM o.local_tipo
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.producao_apontamentos'::regclass
      AND tgname = 'trg_apontamento_atualiza_ordem'
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.producao_apontamentos ENABLE TRIGGER trg_apontamento_atualiza_ordem';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Bloqueia a recorrência: qualquer apontamento vinculado a OP herda
--    processo_id/local_tipo da própria OP antes de ser gravado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sincronizar_apontamento_com_op_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_processo_id UUID;
  v_local_tipo TEXT;
BEGIN
  IF NEW.ordem_producao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.processo_id, o.local_tipo
    INTO v_processo_id, v_local_tipo
    FROM public.producao_ordens_producao o
   WHERE o.id = NEW.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção vinculada ao apontamento não existe';
  END IF;

  NEW.processo_id := v_processo_id;
  NEW.projeto_local_id := NULL;
  NEW.local_tipo := v_local_tipo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sincronizar_apontamento_com_op_v1
  ON public.producao_apontamentos;

CREATE TRIGGER trg_sincronizar_apontamento_com_op_v1
BEFORE INSERT OR UPDATE OF ordem_producao_id, processo_id, projeto_local_id, local_tipo
ON public.producao_apontamentos
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_apontamento_com_op_v1();

-- ---------------------------------------------------------------------------
-- 3. Projeto e Etapa de uma OP são validados no banco e ficam imutáveis
--    depois da criação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bloquear_reparent_op_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_projeto_etapa UUID;
BEGIN
  SELECT p.projeto_id
    INTO v_projeto_etapa
    FROM public.producao_processos p
   WHERE p.id = NEW.processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa da Ordem de Produção não existe';
  END IF;

  IF NEW.projeto_id IS DISTINCT FROM v_projeto_etapa THEN
    RAISE EXCEPTION 'O Projeto da OP deve ser o mesmo Projeto da Etapa';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.processo_id IS DISTINCT FROM NEW.processo_id
       OR OLD.projeto_id IS DISTINCT FROM NEW.projeto_id THEN
      RAISE EXCEPTION
        'Projeto e Etapa da Ordem de Produção não podem ser alterados após a emissão';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_reparent_op_v1
  ON public.producao_ordens_producao;

CREATE TRIGGER trg_bloquear_reparent_op_v1
BEFORE INSERT OR UPDATE OF processo_id, projeto_id
ON public.producao_ordens_producao
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_reparent_op_v1();

-- ---------------------------------------------------------------------------
-- 4. Uma OP concluída deve ter datas reais baseadas na execução registrada,
--    e nunca na data em que o usuário clicou em Finalizar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corrigir_datas_op_concluida_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inicio DATE;
  v_fim DATE;
BEGIN
  IF NEW.status <> 'concluida' THEN
    RETURN NEW;
  END IF;

  SELECT
    MIN(a.data) FILTER (WHERE a.status <> 'cancelado'),
    MAX(a.data) FILTER (WHERE a.status = 'conferido')
    INTO v_inicio, v_fim
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = NEW.id;

  IF v_inicio IS NOT NULL OR v_fim IS NOT NULL THEN
    UPDATE public.producao_ordens_producao
       SET data_inicio_real = COALESCE(v_inicio, data_inicio_real),
           data_fim_real = COALESCE(v_fim, v_inicio, data_fim_real),
           updated_at = NOW()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corrigir_datas_op_concluida_v1
  ON public.producao_ordens_producao;

CREATE TRIGGER trg_corrigir_datas_op_concluida_v1
AFTER UPDATE OF status
ON public.producao_ordens_producao
FOR EACH ROW
WHEN (NEW.status = 'concluida')
EXECUTE FUNCTION public.corrigir_datas_op_concluida_v1();

-- Repara OPs já concluídas.
WITH datas_op AS (
  SELECT
    a.ordem_producao_id,
    MIN(a.data) FILTER (WHERE a.status <> 'cancelado') AS inicio_real,
    MAX(a.data) FILTER (WHERE a.status = 'conferido') AS fim_real
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id IS NOT NULL
  GROUP BY a.ordem_producao_id
)
UPDATE public.producao_ordens_producao o
SET data_inicio_real = COALESCE(d.inicio_real, o.data_inicio_real),
    data_fim_real = COALESCE(d.fim_real, d.inicio_real, o.data_fim_real),
    updated_at = NOW()
FROM datas_op d
WHERE o.id = d.ordem_producao_id
  AND o.status = 'concluida'
  AND (
    o.data_inicio_real IS DISTINCT FROM COALESCE(d.inicio_real, o.data_inicio_real)
    OR o.data_fim_real IS DISTINCT FROM COALESCE(d.fim_real, d.inicio_real, o.data_fim_real)
  );

-- ---------------------------------------------------------------------------
-- 5. Uma Etapa finalizada usa o intervalo real consolidado dos apontamentos
--    pertencentes às suas OPs. Isso elimina barras deslocadas para o dia do
--    clique de finalização.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corrigir_datas_etapa_finalizada_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inicio DATE;
  v_fim DATE;
BEGIN
  IF NEW.status <> 'finalizado' THEN
    RETURN NEW;
  END IF;

  SELECT
    MIN(a.data) FILTER (WHERE a.status <> 'cancelado'),
    MAX(a.data) FILTER (WHERE a.status = 'conferido')
    INTO v_inicio, v_fim
    FROM public.producao_apontamentos a
    LEFT JOIN public.producao_ordens_producao o
      ON o.id = a.ordem_producao_id
   WHERE COALESCE(o.processo_id, a.processo_id) = NEW.id;

  IF v_inicio IS NOT NULL OR v_fim IS NOT NULL THEN
    UPDATE public.producao_processos
       SET data_inicio_real = COALESCE(v_inicio, data_inicio_real),
           data_fim_real = COALESCE(v_fim, v_inicio, data_fim_real),
           updated_at = NOW()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corrigir_datas_etapa_finalizada_v1
  ON public.producao_processos;

CREATE TRIGGER trg_corrigir_datas_etapa_finalizada_v1
AFTER UPDATE OF status
ON public.producao_processos
FOR EACH ROW
WHEN (NEW.status = 'finalizado')
EXECUTE FUNCTION public.corrigir_datas_etapa_finalizada_v1();

-- Repara Etapas já finalizadas.
WITH execucao_etapa AS (
  SELECT
    COALESCE(o.processo_id, a.processo_id) AS processo_id,
    MIN(a.data) FILTER (WHERE a.status <> 'cancelado') AS inicio_real,
    MAX(a.data) FILTER (WHERE a.status = 'conferido') AS fim_real
  FROM public.producao_apontamentos a
  LEFT JOIN public.producao_ordens_producao o
    ON o.id = a.ordem_producao_id
  WHERE COALESCE(o.processo_id, a.processo_id) IS NOT NULL
  GROUP BY COALESCE(o.processo_id, a.processo_id)
)
UPDATE public.producao_processos p
SET data_inicio_real = COALESCE(e.inicio_real, p.data_inicio_real),
    data_fim_real = COALESCE(e.fim_real, e.inicio_real, p.data_fim_real),
    updated_at = NOW()
FROM execucao_etapa e
WHERE p.id = e.processo_id
  AND p.status = 'finalizado'
  AND (
    p.data_inicio_real IS DISTINCT FROM COALESCE(e.inicio_real, p.data_inicio_real)
    OR p.data_fim_real IS DISTINCT FROM COALESCE(e.fim_real, e.inicio_real, p.data_fim_real)
  );

-- ---------------------------------------------------------------------------
-- 6. Gantt: a quantidade realizada da Etapa passa a ser consolidada pela
--    relação OP -> Etapa. processo_id do apontamento vira redundância
--    sincronizada, e não mais a única fonte de verdade.
-- ---------------------------------------------------------------------------
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
      ELSE LEAST(100, ROUND(
        (COALESCE(r.realizado, 0) / p.quantidade_planejada) * 100,
        2
      ))
    END,
    p.status,
    p.prioridade,
    p.data_inicio_desejada,
    p.data_limite,
    p.data_inicio_prevista,
    p.data_fim_prevista,
    COALESCE(r.inicio_real, p.data_inicio_real),
    CASE
      WHEN p.status IN ('finalizado', 'cancelado')
        THEN COALESCE(r.fim_real, r.inicio_real, p.data_fim_real)
      ELSE p.data_fim_real
    END,
    p.capacidade_diaria,
    p.pessoas_necessarias,
    COALESCE(al.alocacoes, '[]'::jsonb),
    COALESCE(ops.ordens, '[]'::jsonb)
  FROM public.producao_processos p
  JOIN public.producao_projetos pr
    ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT
      COALESCE(o.processo_id, a.processo_id) AS processo_id,
      COALESCE(SUM(a.quantidade_produzida)
        FILTER (WHERE a.status = 'conferido'), 0) AS realizado,
      MIN(a.data) FILTER (WHERE a.status <> 'cancelado') AS inicio_real,
      MAX(a.data) FILTER (WHERE a.status = 'conferido') AS fim_real
    FROM public.producao_apontamentos a
    LEFT JOIN public.producao_ordens_producao o
      ON o.id = a.ordem_producao_id
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
          WHEN o.quantidade_planejada > 0 THEN
            LEAST(100, ROUND(
              (COALESCE(ap.realizado, 0) / o.quantidade_planejada) * 100,
              2
            ))
          ELSE 0
        END AS percentual_realizado
      FROM public.producao_ordens_producao o
      LEFT JOIN (
        SELECT
          ordem_producao_id,
          SUM(COALESCE(quantidade_produzida, 0)) AS realizado
        FROM public.producao_apontamentos
        WHERE status = 'conferido'
          AND ordem_producao_id IS NOT NULL
        GROUP BY ordem_producao_id
      ) ap ON ap.ordem_producao_id = o.id
      WHERE o.processo_id = p.id
    ) x
  ) ops ON TRUE
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome, p.sequencia, p.created_at;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_apontamento_com_op_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bloquear_reparent_op_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corrigir_datas_op_concluida_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corrigir_datas_etapa_finalizada_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
