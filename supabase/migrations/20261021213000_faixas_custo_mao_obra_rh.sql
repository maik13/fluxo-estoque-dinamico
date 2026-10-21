BEGIN;

CREATE TABLE IF NOT EXISTS public.rh_colaborador_faixas_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  dias_semana smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  valor_hora numeric(12,2) NOT NULL,
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rh_faixa_nome CHECK (btrim(nome) <> ''),
  CONSTRAINT rh_faixa_dias CHECK (cardinality(dias_semana) > 0 AND dias_semana <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  CONSTRAINT rh_faixa_horario CHECK (hora_inicio <> hora_fim),
  CONSTRAINT rh_faixa_valor CHECK (valor_hora >= 0)
);

CREATE INDEX IF NOT EXISTS rh_colaborador_faixas_custo_colaborador_idx
  ON public.rh_colaborador_faixas_custo(colaborador_id, ativo, prioridade DESC);

ALTER TABLE public.rh_colaborador_faixas_custo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_faixas_custo_select ON public.rh_colaborador_faixas_custo;
CREATE POLICY rh_faixas_custo_select ON public.rh_colaborador_faixas_custo
FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_visualizar')
  OR public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_gerenciar')
  OR public.permissao_individual_efetiva((select auth.uid()), 'producao.bi.custos')
);

REVOKE ALL ON TABLE public.rh_colaborador_faixas_custo FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.rh_colaborador_faixas_custo TO authenticated;

CREATE TABLE IF NOT EXISTS public.rh_faixas_custo_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE RESTRICT,
  faixas_anteriores jsonb NOT NULL DEFAULT '[]'::jsonb,
  faixas_novas jsonb NOT NULL DEFAULT '[]'::jsonb,
  alterado_por uuid NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_faixas_custo_auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_faixas_custo_auditoria_select ON public.rh_faixas_custo_auditoria;
CREATE POLICY rh_faixas_custo_auditoria_select ON public.rh_faixas_custo_auditoria
FOR SELECT TO authenticated
USING (
  public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_visualizar')
  OR public.permissao_individual_efetiva((select auth.uid()), 'rh_colaboradores_gerenciar')
);
REVOKE ALL ON TABLE public.rh_faixas_custo_auditoria FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.rh_faixas_custo_auditoria TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_substituir_faixas_custo(
  p_colaborador_id uuid,
  p_faixas jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_anteriores jsonb;
  v_novas jsonb := coalesce(p_faixas, '[]'::jsonb);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF NOT public.permissao_individual_efetiva(v_user, 'rh_colaboradores_gerenciar') THEN
    RAISE EXCEPTION 'Usuário sem permissão para gerenciar custos do RH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = p_colaborador_id) THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;
  IF jsonb_typeof(v_novas) <> 'array' THEN RAISE EXCEPTION 'Faixas inválidas'; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(f) - 'colaborador_id' ORDER BY f.prioridade, f.hora_inicio), '[]'::jsonb)
  INTO v_anteriores
  FROM public.rh_colaborador_faixas_custo f
  WHERE f.colaborador_id = p_colaborador_id;

  DELETE FROM public.rh_colaborador_faixas_custo WHERE colaborador_id = p_colaborador_id;

  INSERT INTO public.rh_colaborador_faixas_custo (
    colaborador_id, nome, dias_semana, hora_inicio, hora_fim, valor_hora, prioridade, ativo
  )
  SELECT
    p_colaborador_id,
    btrim(item->>'nome'),
    ARRAY(SELECT value::smallint FROM jsonb_array_elements_text(item->'dias_semana')),
    (item->>'hora_inicio')::time,
    (item->>'hora_fim')::time,
    (item->>'valor_hora')::numeric,
    coalesce((item->>'prioridade')::integer, ordinality::integer),
    coalesce((item->>'ativo')::boolean, true)
  FROM jsonb_array_elements(v_novas) WITH ORDINALITY AS x(item, ordinality);

  INSERT INTO public.rh_faixas_custo_auditoria (
    colaborador_id, faixas_anteriores, faixas_novas, alterado_por
  ) VALUES (p_colaborador_id, v_anteriores, v_novas, v_user);
END;
$$;

REVOKE ALL ON FUNCTION public.rh_substituir_faixas_custo(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rh_substituir_faixas_custo(uuid, jsonb) TO authenticated;

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS custo_total_snapshot numeric(14,2),
  ADD COLUMN IF NOT EXISTS faixas_custo_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.calcular_custo_faixas_rh(
  p_colaborador_id uuid,
  p_inicio timestamp,
  p_fim timestamp,
  p_valor_hora_padrao numeric
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH minutos AS (
    SELECT instante
    FROM generate_series(p_inicio, p_fim - interval '1 minute', interval '1 minute') instante
  ), valores AS (
    SELECT
      m.instante,
      coalesce(f.valor_hora, p_valor_hora_padrao) AS valor_hora,
      f.id AS faixa_id,
      f.nome AS faixa_nome
    FROM minutos m
    LEFT JOIN LATERAL (
      SELECT faixa.id, faixa.nome, faixa.valor_hora
      FROM public.rh_colaborador_faixas_custo faixa
      WHERE faixa.colaborador_id = p_colaborador_id
        AND faixa.ativo
        AND extract(isodow FROM m.instante)::smallint = ANY(faixa.dias_semana)
        AND (
          (faixa.hora_inicio < faixa.hora_fim AND m.instante::time >= faixa.hora_inicio AND m.instante::time < faixa.hora_fim)
          OR (faixa.hora_inicio > faixa.hora_fim AND (m.instante::time >= faixa.hora_inicio OR m.instante::time < faixa.hora_fim))
        )
      ORDER BY faixa.prioridade DESC, faixa.created_at DESC
      LIMIT 1
    ) f ON true
  ), agrupado AS (
    SELECT faixa_id, faixa_nome, valor_hora, count(*)::integer AS minutos
    FROM valores
    GROUP BY faixa_id, faixa_nome, valor_hora
  )
  SELECT jsonb_build_object(
    'duracao_minutos', (SELECT count(*) FROM valores),
    'incompleto', EXISTS (SELECT 1 FROM valores WHERE valor_hora IS NULL),
    'custo_total', CASE
      WHEN EXISTS (SELECT 1 FROM valores WHERE valor_hora IS NULL) THEN NULL
      ELSE round(coalesce((SELECT sum(valor_hora / 60) FROM valores), 0), 2)
    END,
    'faixas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'faixa_id', faixa_id,
        'nome', coalesce(faixa_nome, 'Valor padrão'),
        'valor_hora', valor_hora,
        'minutos', minutos,
        'custo', CASE WHEN valor_hora IS NULL THEN NULL ELSE round(valor_hora * minutos / 60, 2) END
      ) ORDER BY valor_hora NULLS LAST)
      FROM agrupado
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.calcular_custo_faixas_rh(uuid, timestamp, timestamp, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preencher_custo_faixas_apontamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento public.producao_apontamentos%ROWTYPE;
  v_membro public.producao_membros%ROWTYPE;
  v_inicio timestamp;
  v_fim timestamp;
  v_resultado jsonb;
  v_duracao integer;
BEGIN
  IF TG_OP <> 'INSERT' OR NEW.faixas_custo_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_apontamento FROM public.producao_apontamentos WHERE id = NEW.apontamento_id;
  SELECT * INTO v_membro FROM public.producao_membros WHERE id = NEW.membro_id;

  v_inicio := v_apontamento.data + coalesce(NEW.inicio_individual, v_apontamento.inicio);
  v_fim := v_apontamento.data + coalesce(NEW.termino_individual, v_apontamento.termino);
  IF v_fim <= v_inicio THEN v_fim := v_fim + interval '1 day'; END IF;

  v_resultado := public.calcular_custo_faixas_rh(
    v_membro.rh_colaborador_id, v_inicio, v_fim, v_membro.valor_hora
  );
  v_duracao := nullif((v_resultado->>'duracao_minutos')::integer, 0);

  NEW.faixas_custo_snapshot := v_resultado;
  NEW.custo_total_snapshot := (v_resultado->>'custo_total')::numeric;
  NEW.valor_hora_snapshot := CASE
    WHEN NEW.custo_total_snapshot IS NULL OR v_duracao IS NULL THEN NULL
    ELSE round(NEW.custo_total_snapshot * 60 / v_duracao, 2)
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.preencher_custo_faixas_apontamento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_custo_faixas_apontamento ON public.producao_apontamento_membros;
CREATE TRIGGER trg_custo_faixas_apontamento
BEFORE INSERT ON public.producao_apontamento_membros
FOR EACH ROW EXECUTE FUNCTION public.preencher_custo_faixas_apontamento();

COMMIT;
