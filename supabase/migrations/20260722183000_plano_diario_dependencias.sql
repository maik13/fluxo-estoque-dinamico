-- Etapa 2 do cronograma integrado de Produção.
-- Adiciona dependências, configuração de capacidade, alocações diárias e recálculo automático.

BEGIN;

ALTER TABLE public.producao_processos
  ADD COLUMN IF NOT EXISTS data_inicio_desejada DATE NULL,
  ADD COLUMN IF NOT EXISTS data_limite DATE NULL;

UPDATE public.producao_processos
SET data_inicio_desejada = COALESCE(data_inicio_desejada, data_inicio_prevista),
    data_limite = COALESCE(data_limite, data_fim_prevista)
WHERE data_inicio_desejada IS NULL OR data_limite IS NULL;

CREATE TABLE IF NOT EXISTS public.producao_cronograma_configuracoes (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  equipe_disponivel_por_dia NUMERIC NOT NULL DEFAULT 5 CHECK (equipe_disponivel_por_dia >= 0),
  trabalha_sabado BOOLEAN NOT NULL DEFAULT false,
  trabalha_domingo BOOLEAN NOT NULL DEFAULT false,
  horizonte_dias INTEGER NOT NULL DEFAULT 365 CHECK (horizonte_dias BETWEEN 30 AND 1825),
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.producao_cronograma_configuracoes (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.producao_processo_dependencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  depende_de_processo_id UUID NOT NULL REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'fim_inicio' CHECK (tipo IN ('fim_inicio', 'inicio_inicio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_dependencia_sem_autorreferencia CHECK (processo_id <> depende_de_processo_id),
  CONSTRAINT producao_dependencia_unica UNIQUE (processo_id, depende_de_processo_id)
);

CREATE INDEX IF NOT EXISTS producao_dependencias_processo_idx
  ON public.producao_processo_dependencias(processo_id);
CREATE INDEX IF NOT EXISTS producao_dependencias_predecessora_idx
  ON public.producao_processo_dependencias(depende_de_processo_id);

CREATE TABLE IF NOT EXISTS public.producao_alocacoes_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  quantidade_planejada NUMERIC NOT NULL CHECK (quantidade_planejada >= 0),
  pessoas_planejadas NUMERIC NOT NULL CHECK (pessoas_planejadas >= 0),
  versao_calculo UUID NOT NULL,
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_alocacao_processo_data_unique UNIQUE (processo_id, data)
);

CREATE INDEX IF NOT EXISTS producao_alocacoes_data_idx
  ON public.producao_alocacoes_diarias(data, processo_id);

CREATE TABLE IF NOT EXISTS public.producao_cronograma_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NULL REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  data DATE NULL,
  severidade TEXT NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta')),
  codigo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  versao_calculo UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS producao_cronograma_alertas_versao_idx
  ON public.producao_cronograma_alertas(versao_calculo, severidade);

ALTER TABLE public.producao_cronograma_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_processo_dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_alocacoes_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_cronograma_alertas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'producao_cronograma_configuracoes',
        'producao_processo_dependencias',
        'producao_alocacoes_diarias',
        'producao_cronograma_alertas'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  END LOOP;
END $$;

CREATE POLICY producao_cronograma_config_select
  ON public.producao_cronograma_configuracoes FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));
CREATE POLICY producao_dependencias_select
  ON public.producao_processo_dependencias FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));
CREATE POLICY producao_alocacoes_select
  ON public.producao_alocacoes_diarias FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));
CREATE POLICY producao_cronograma_alertas_select
  ON public.producao_cronograma_alertas FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE OR REPLACE FUNCTION public.recalcular_cronograma_producao_interno(
  p_usuario_id UUID,
  p_usuario_nome TEXT
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_config public.producao_cronograma_configuracoes%ROWTYPE;
  v_versao UUID := gen_random_uuid();
  v_data DATE;
  v_inicio DATE;
  v_indice INTEGER;
  v_disponivel NUMERIC;
  v_etapa RECORD;
  v_dependencias_ok BOOLEAN;
  v_pessoas NUMERIC;
  v_quantidade NUMERIC;
  v_saldo NUMERIC;
  v_razao NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('producao_cronograma_oficial', 0));

  SELECT * INTO v_config
  FROM public.producao_cronograma_configuracoes
  WHERE id = 1
  FOR UPDATE;

  DELETE FROM public.producao_alocacoes_diarias;
  DELETE FROM public.producao_cronograma_alertas;

  CREATE TEMP TABLE IF NOT EXISTS tmp_producao_etapas_cronograma (
    processo_id UUID PRIMARY KEY,
    prioridade_ordem INTEGER NOT NULL,
    sequencia INTEGER NOT NULL,
    inicio_desejado DATE NOT NULL,
    data_limite DATE NULL,
    saldo_total NUMERIC NOT NULL,
    capacidade_diaria NUMERIC NOT NULL,
    pessoas_necessarias NUMERIC NOT NULL,
    aceita_proporcional BOOLEAN NOT NULL,
    quantidade_simulada NUMERIC NOT NULL DEFAULT 0,
    iniciou BOOLEAN NOT NULL DEFAULT false,
    inicio_calculado DATE NULL,
    fim_calculado DATE NULL,
    inicio_anterior DATE NULL,
    fim_anterior DATE NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.tmp_producao_etapas_cronograma;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, severidade, codigo, mensagem, versao_calculo
  )
  SELECT p.id, 'alta', 'PARAMETROS_INCOMPLETOS',
    'A etapa precisa de quantidade planejada, capacidade diária e pessoas necessárias para entrar no plano automático.',
    v_versao
  FROM public.producao_processos p
  WHERE p.status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado')
    AND (
      COALESCE(p.quantidade_planejada, 0) <= 0
      OR COALESCE(p.capacidade_diaria, 0) <= 0
      OR COALESCE(p.pessoas_necessarias, 0) < 0
    );

  INSERT INTO pg_temp.tmp_producao_etapas_cronograma (
    processo_id, prioridade_ordem, sequencia, inicio_desejado, data_limite,
    saldo_total, capacidade_diaria, pessoas_necessarias, aceita_proporcional,
    inicio_anterior, fim_anterior
  )
  SELECT
    p.id,
    CASE p.prioridade WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    COALESCE(p.sequencia, 0),
    COALESCE(p.data_inicio_desejada, p.data_inicio_prevista, CURRENT_DATE),
    p.data_limite,
    GREATEST(COALESCE(p.quantidade_planejada, 0) - COALESCE(r.realizado, 0), 0),
    p.capacidade_diaria,
    COALESCE(p.pessoas_necessarias, 0),
    COALESCE(p.aceita_producao_proporcional, false),
    p.data_inicio_prevista,
    p.data_fim_prevista
  FROM public.producao_processos p
  LEFT JOIN (
    SELECT processo_id, COALESCE(SUM(quantidade_produzida), 0) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id
  ) r ON r.processo_id = p.id
  WHERE p.status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado')
    AND COALESCE(p.quantidade_planejada, 0) > 0
    AND COALESCE(p.capacidade_diaria, 0) > 0
    AND COALESCE(p.pessoas_necessarias, 0) >= 0;

  SELECT COALESCE(MIN(inicio_desejado), CURRENT_DATE) INTO v_inicio
  FROM pg_temp.tmp_producao_etapas_cronograma;

  FOR v_indice IN 0..(v_config.horizonte_dias - 1) LOOP
    v_data := v_inicio + v_indice;

    IF (EXTRACT(ISODOW FROM v_data) = 6 AND NOT v_config.trabalha_sabado)
       OR (EXTRACT(ISODOW FROM v_data) = 7 AND NOT v_config.trabalha_domingo) THEN
      CONTINUE;
    END IF;

    v_disponivel := v_config.equipe_disponivel_por_dia;

    FOR v_etapa IN
      SELECT *
      FROM pg_temp.tmp_producao_etapas_cronograma
      WHERE quantidade_simulada < saldo_total
        AND inicio_desejado <= v_data
      ORDER BY prioridade_ordem, sequencia, processo_id
    LOOP
      SELECT COALESCE(bool_and(
        CASE d.tipo
          WHEN 'fim_inicio' THEN pai.quantidade_simulada >= pai.saldo_total
          WHEN 'inicio_inicio' THEN pai.iniciou
          ELSE false
        END
      ), true)
      INTO v_dependencias_ok
      FROM public.producao_processo_dependencias d
      JOIN pg_temp.tmp_producao_etapas_cronograma pai
        ON pai.processo_id = d.depende_de_processo_id
      WHERE d.processo_id = v_etapa.processo_id;

      IF NOT v_dependencias_ok THEN CONTINUE; END IF;

      v_pessoas := v_etapa.pessoas_necessarias;
      v_quantidade := v_etapa.capacidade_diaria;

      IF v_pessoas > v_disponivel THEN
        IF v_etapa.aceita_proporcional AND v_disponivel > 0 AND v_pessoas > 0 THEN
          v_razao := v_disponivel / v_pessoas;
          v_quantidade := v_quantidade * v_razao;
          v_pessoas := v_disponivel;
        ELSE
          INSERT INTO public.producao_cronograma_alertas (
            processo_id, data, severidade, codigo, mensagem, versao_calculo
          ) VALUES (
            v_etapa.processo_id, v_data, 'media', 'EQUIPE_INSUFICIENTE',
            'Equipe disponível insuficiente para alocar a etapa neste dia.', v_versao
          );
          CONTINUE;
        END IF;
      END IF;

      v_saldo := v_etapa.saldo_total - v_etapa.quantidade_simulada;
      v_quantidade := LEAST(v_saldo, v_quantidade);
      IF v_quantidade <= 0 THEN CONTINUE; END IF;

      INSERT INTO public.producao_alocacoes_diarias (
        processo_id, data, quantidade_planejada, pessoas_planejadas, versao_calculo
      ) VALUES (
        v_etapa.processo_id, v_data, ROUND(v_quantidade, 2), ROUND(v_pessoas, 2), v_versao
      );

      UPDATE pg_temp.tmp_producao_etapas_cronograma
      SET quantidade_simulada = quantidade_simulada + v_quantidade,
          iniciou = true,
          inicio_calculado = COALESCE(inicio_calculado, v_data),
          fim_calculado = v_data
      WHERE processo_id = v_etapa.processo_id;

      v_disponivel := GREATEST(0, v_disponivel - v_pessoas);
      IF v_disponivel <= 0 THEN EXIT; END IF;
    END LOOP;
  END LOOP;

  UPDATE public.producao_processos p
  SET data_inicio_prevista = t.inicio_calculado,
      data_fim_prevista = t.fim_calculado,
      atualizado_por_id = p_usuario_id,
      atualizado_por_nome_snapshot = p_usuario_nome,
      updated_at = now()
  FROM pg_temp.tmp_producao_etapas_cronograma t
  WHERE p.id = t.processo_id;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, severidade, codigo, mensagem, versao_calculo
  )
  SELECT processo_id, 'alta', 'NAO_ALOCADA',
    'Não foi possível alocar toda a quantidade da etapa dentro do horizonte configurado.',
    v_versao
  FROM pg_temp.tmp_producao_etapas_cronograma
  WHERE quantidade_simulada < saldo_total;

  INSERT INTO public.producao_cronograma_alertas (
    processo_id, data, severidade, codigo, mensagem, versao_calculo
  )
  SELECT processo_id, data_limite, 'alta', 'PRAZO_ULTRAPASSADO',
    'A previsão calculada ultrapassa o prazo final informado.', v_versao
  FROM pg_temp.tmp_producao_etapas_cronograma
  WHERE data_limite IS NOT NULL AND fim_calculado IS NOT NULL AND fim_calculado > data_limite;

  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status,
    usuario_responsavel_id, nome_usuario_snapshot, dados_complementares,
    valores_anteriores, valores_posteriores
  )
  SELECT
    p.id, 'cronograma_recalculado', p.status, p.status,
    p_usuario_id, p_usuario_nome,
    jsonb_build_object('versao_calculo', v_versao),
    jsonb_build_object('data_inicio_prevista', t.inicio_anterior, 'data_fim_prevista', t.fim_anterior),
    jsonb_build_object('data_inicio_prevista', t.inicio_calculado, 'data_fim_prevista', t.fim_calculado)
  FROM public.producao_processos p
  JOIN pg_temp.tmp_producao_etapas_cronograma t ON t.processo_id = p.id
  WHERE t.inicio_anterior IS DISTINCT FROM t.inicio_calculado
     OR t.fim_anterior IS DISTINCT FROM t.fim_calculado;

  RETURN v_versao;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalcular_cronograma_producao_interno(UUID, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.recalcular_cronograma_producao()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para recalcular o cronograma';
  END IF;
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;
  RETURN public.recalcular_cronograma_producao_interno(v_user, v_nome);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalcular_cronograma_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalcular_cronograma_producao() TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_cronograma_producao(
  p_equipe_disponivel NUMERIC,
  p_trabalha_sabado BOOLEAN,
  p_trabalha_domingo BOOLEAN,
  p_horizonte_dias INTEGER DEFAULT 365
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para configurar o cronograma';
  END IF;
  IF p_equipe_disponivel < 0 THEN RAISE EXCEPTION 'Equipe disponível inválida'; END IF;
  IF p_horizonte_dias < 30 OR p_horizonte_dias > 1825 THEN RAISE EXCEPTION 'Horizonte inválido'; END IF;
  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;
  UPDATE public.producao_cronograma_configuracoes
  SET equipe_disponivel_por_dia = p_equipe_disponivel,
      trabalha_sabado = COALESCE(p_trabalha_sabado, false),
      trabalha_domingo = COALESCE(p_trabalha_domingo, false),
      horizonte_dias = p_horizonte_dias,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = now()
  WHERE id = 1;
  RETURN public.recalcular_cronograma_producao_interno(v_user, v_nome);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.salvar_configuracao_cronograma_producao(NUMERIC, BOOLEAN, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_configuracao_cronograma_producao(NUMERIC, BOOLEAN, BOOLEAN, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.salvar_planejamento_etapa_producao(
  p_processo_id UUID,
  p_data_inicio_desejada DATE DEFAULT NULL,
  p_data_limite DATE DEFAULT NULL,
  p_grupo_cronograma TEXT DEFAULT NULL,
  p_sequencia INTEGER DEFAULT 0,
  p_capacidade_diaria NUMERIC DEFAULT NULL,
  p_pessoas_necessarias NUMERIC DEFAULT NULL,
  p_aceita_producao_proporcional BOOLEAN DEFAULT false,
  p_dependencias JSONB DEFAULT '[]'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_projeto UUID;
  v_anterior JSONB;
  v_posterior JSONB;
  v_item JSONB;
  v_dep UUID;
  v_tipo TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para editar o planejamento da etapa';
  END IF;
  IF p_data_inicio_desejada IS NOT NULL AND p_data_limite IS NOT NULL AND p_data_limite < p_data_inicio_desejada THEN
    RAISE EXCEPTION 'O prazo final não pode ser anterior ao início desejado';
  END IF;
  IF p_capacidade_diaria IS NOT NULL AND p_capacidade_diaria <= 0 THEN RAISE EXCEPTION 'Capacidade diária inválida'; END IF;
  IF p_pessoas_necessarias IS NOT NULL AND p_pessoas_necessarias < 0 THEN RAISE EXCEPTION 'Pessoas necessárias inválidas'; END IF;
  IF jsonb_typeof(COALESCE(p_dependencias, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Dependências inválidas'; END IF;

  SELECT projeto_id, to_jsonb(p) INTO v_projeto, v_anterior
  FROM public.producao_processos p WHERE id = p_processo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  UPDATE public.producao_processos
  SET data_inicio_desejada = p_data_inicio_desejada,
      data_limite = p_data_limite,
      grupo_cronograma = NULLIF(btrim(p_grupo_cronograma), ''),
      sequencia = GREATEST(COALESCE(p_sequencia, 0), 0),
      capacidade_diaria = p_capacidade_diaria,
      pessoas_necessarias = p_pessoas_necessarias,
      aceita_producao_proporcional = COALESCE(p_aceita_producao_proporcional, false),
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = now()
  WHERE id = p_processo_id;

  DELETE FROM public.producao_processo_dependencias WHERE processo_id = p_processo_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_dependencias, '[]'::jsonb)) LOOP
    v_dep := NULLIF(v_item->>'etapa_id', '')::UUID;
    v_tipo := COALESCE(NULLIF(v_item->>'tipo', ''), 'fim_inicio');
    IF v_dep IS NULL OR v_dep = p_processo_id THEN RAISE EXCEPTION 'Dependência inválida'; END IF;
    IF v_tipo NOT IN ('fim_inicio', 'inicio_inicio') THEN RAISE EXCEPTION 'Tipo de dependência inválido'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.producao_processos
      WHERE id = v_dep AND projeto_id = v_projeto
    ) THEN RAISE EXCEPTION 'A etapa predecessora deve pertencer ao mesmo projeto'; END IF;
    INSERT INTO public.producao_processo_dependencias (processo_id, depende_de_processo_id, tipo)
    VALUES (p_processo_id, v_dep, v_tipo);
  END LOOP;

  SELECT to_jsonb(p) INTO v_posterior FROM public.producao_processos p WHERE id = p_processo_id;
  INSERT INTO public.producao_processo_eventos (
    processo_id, tipo_evento, status_anterior, novo_status, usuario_responsavel_id,
    nome_usuario_snapshot, dados_complementares, valores_anteriores, valores_posteriores
  )
  SELECT id, 'planejamento_atualizado', status, status, v_user, v_nome,
    jsonb_build_object('dependencias', COALESCE(p_dependencias, '[]'::jsonb)), v_anterior, v_posterior
  FROM public.producao_processos WHERE id = p_processo_id;

  RETURN public.recalcular_cronograma_producao_interno(v_user, v_nome);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.salvar_planejamento_etapa_producao(UUID, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_planejamento_etapa_producao(UUID, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.criar_etapa_producao(
  p_projeto_local_id UUID,
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_codigo TEXT DEFAULT NULL,
  p_produto_entregavel TEXT DEFAULT NULL,
  p_unidade_medida TEXT DEFAULT NULL,
  p_quantidade_planejada NUMERIC DEFAULT NULL,
  p_data_inicio_desejada DATE DEFAULT NULL,
  p_data_limite DATE DEFAULT NULL,
  p_grupo_cronograma TEXT DEFAULT NULL,
  p_sequencia INTEGER DEFAULT 0,
  p_capacidade_diaria NUMERIC DEFAULT NULL,
  p_pessoas_necessarias NUMERIC DEFAULT NULL,
  p_aceita_producao_proporcional BOOLEAN DEFAULT false,
  p_dependencias JSONB DEFAULT '[]'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := public.criar_processo_producao(
    p_projeto_local_id, p_nome, p_descricao, p_prioridade, p_codigo,
    p_produto_entregavel, p_unidade_medida, p_quantidade_planejada
  );
  PERFORM public.salvar_planejamento_etapa_producao(
    v_id, p_data_inicio_desejada, p_data_limite, p_grupo_cronograma,
    p_sequencia, p_capacidade_diaria, p_pessoas_necessarias,
    p_aceita_producao_proporcional, p_dependencias
  );
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.criar_etapa_producao(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_etapa_producao(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, DATE, TEXT, INTEGER, NUMERIC, NUMERIC, BOOLEAN, JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.listar_gantt_producao();
CREATE FUNCTION public.listar_gantt_producao()
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
  alocacoes JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    p.id, p.codigo, p.nome, p.projeto_id, pr.nome, pr.cidade, pr.uf,
    p.grupo_cronograma, p.sequencia, p.unidade_medida, p.quantidade_planejada,
    COALESCE(r.realizado, 0),
    CASE WHEN COALESCE(p.quantidade_planejada, 0) <= 0 THEN 0
      ELSE LEAST(100, ROUND((COALESCE(r.realizado, 0) / p.quantidade_planejada) * 100, 2)) END,
    p.status, p.prioridade, p.data_inicio_desejada, p.data_limite,
    p.data_inicio_prevista, p.data_fim_prevista, p.data_inicio_real, p.data_fim_real,
    p.capacidade_diaria, p.pessoas_necessarias,
    COALESCE(a.alocacoes, '[]'::jsonb)
  FROM public.producao_processos p
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT processo_id, COALESCE(SUM(quantidade_produzida), 0) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id
  ) r ON r.processo_id = p.id
  LEFT JOIN (
    SELECT processo_id,
      jsonb_agg(jsonb_build_object(
        'data', data,
        'quantidade_planejada', quantidade_planejada,
        'pessoas_planejadas', pessoas_planejadas
      ) ORDER BY data) AS alocacoes
    FROM public.producao_alocacoes_diarias
    GROUP BY processo_id
  ) a ON a.processo_id = p.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome, p.sequencia, p.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_plano_diario_producao(
  p_data_inicio DATE,
  p_dias INTEGER DEFAULT 60
) RETURNS TABLE (
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
    p.id, p.codigo, p.nome, p.projeto_id, pr.nome, p.grupo_cronograma,
    p.unidade_medida, a.data, a.quantidade_planejada, a.pessoas_planejadas,
    COALESCE(r.quantidade_realizada, 0), p.status
  FROM public.producao_alocacoes_diarias a
  JOIN public.producao_processos p ON p.id = a.processo_id
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT processo_id, data, SUM(quantidade_produzida) AS quantidade_realizada
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id, data
  ) r ON r.processo_id = a.processo_id AND r.data = a.data
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND a.data >= p_data_inicio
    AND a.data < p_data_inicio + LEAST(GREATEST(COALESCE(p_dias, 60), 1), 180)
  ORDER BY pr.nome, p.sequencia, a.data;
$$;
REVOKE EXECUTE ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_plano_diario_producao(DATE, INTEGER) TO authenticated;

COMMIT;
