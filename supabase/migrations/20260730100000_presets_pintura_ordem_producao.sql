-- Presets técnicos de pintura e cálculo automático do consumo previsto nas OPs.
-- Regras iniciais validadas:
-- - ripa de referência: 4 cm x 2 m;
-- - pintura de miolo: 6,7 mL por ripa;
-- - pintura de casca: 4,316 mL por ripa;
-- - pintura de painel: somente casca; 25 ripas x 4,316 mL = 107,9 mL por painel.

BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_presets_pintura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  comprimento_ripa_m NUMERIC(10,3) NOT NULL DEFAULT 2.000
    CHECK (comprimento_ripa_m > 0),
  largura_ripa_cm NUMERIC(10,3) NOT NULL DEFAULT 4.000
    CHECK (largura_ripa_cm > 0),
  ripas_por_painel NUMERIC(12,3) NOT NULL DEFAULT 25.000
    CHECK (ripas_por_painel > 0),
  consumo_miolo_ml_por_ripa NUMERIC(12,4) NOT NULL DEFAULT 6.7000
    CHECK (consumo_miolo_ml_por_ripa > 0),
  consumo_casca_ml_por_ripa NUMERIC(12,4) NOT NULL DEFAULT 4.3160
    CHECK (consumo_casca_ml_por_ripa > 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por_id UUID NULL,
  criado_por_nome_snapshot TEXT NULL,
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_presets_pintura_nome_unique UNIQUE (nome)
);

ALTER TABLE public.producao_presets_pintura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_presets_pintura_leitura
  ON public.producao_presets_pintura;
CREATE POLICY producao_presets_pintura_leitura
  ON public.producao_presets_pintura
  FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

GRANT SELECT ON public.producao_presets_pintura TO authenticated;

INSERT INTO public.producao_presets_pintura (
  nome,
  comprimento_ripa_m,
  largura_ripa_cm,
  ripas_por_painel,
  consumo_miolo_ml_por_ripa,
  consumo_casca_ml_por_ripa,
  ativo,
  criado_por_nome_snapshot,
  atualizado_por_nome_snapshot
)
SELECT
  'Ripa 40 x 2.000 mm — padrão',
  2.000,
  4.000,
  25.000,
  6.7000,
  4.3160,
  TRUE,
  'Preset inicial do sistema',
  'Preset inicial do sistema'
WHERE NOT EXISTS (
  SELECT 1 FROM public.producao_presets_pintura
);

ALTER TABLE public.producao_ordens_producao
  ADD COLUMN IF NOT EXISTS pintura_tipo TEXT NULL,
  ADD COLUMN IF NOT EXISTS pintura_preset_id UUID NULL
    REFERENCES public.producao_presets_pintura(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pintura_preset_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS pintura_comprimento_ripa_m_snapshot NUMERIC(10,3) NULL,
  ADD COLUMN IF NOT EXISTS pintura_largura_ripa_cm_snapshot NUMERIC(10,3) NULL,
  ADD COLUMN IF NOT EXISTS pintura_ripas_por_painel_snapshot NUMERIC(12,3) NULL,
  ADD COLUMN IF NOT EXISTS pintura_consumo_ml_por_ripa_snapshot NUMERIC(12,4) NULL,
  ADD COLUMN IF NOT EXISTS pintura_quantidade_ripas_calculada NUMERIC(14,3) NULL,
  ADD COLUMN IF NOT EXISTS pintura_consumo_ml_por_unidade NUMERIC(14,4) NULL,
  ADD COLUMN IF NOT EXISTS pintura_consumo_total_ml NUMERIC(16,4) NULL;

ALTER TABLE public.producao_ordens_producao
  DROP CONSTRAINT IF EXISTS producao_ordens_pintura_tipo_check,
  DROP CONSTRAINT IF EXISTS producao_ordens_pintura_consistencia_check;

ALTER TABLE public.producao_ordens_producao
  ADD CONSTRAINT producao_ordens_pintura_tipo_check
    CHECK (pintura_tipo IS NULL OR pintura_tipo IN ('miolo','casca','painel')),
  ADD CONSTRAINT producao_ordens_pintura_consistencia_check
    CHECK (
      pintura_tipo IS NULL
      OR (
        pintura_preset_id IS NOT NULL
        AND pintura_preset_nome_snapshot IS NOT NULL
        AND pintura_comprimento_ripa_m_snapshot > 0
        AND pintura_largura_ripa_cm_snapshot > 0
        AND pintura_ripas_por_painel_snapshot > 0
        AND pintura_consumo_ml_por_ripa_snapshot > 0
        AND pintura_quantidade_ripas_calculada > 0
        AND pintura_consumo_ml_por_unidade > 0
        AND pintura_consumo_total_ml > 0
      )
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS producao_ordens_pintura_idx
  ON public.producao_ordens_producao(pintura_tipo, pintura_preset_id)
  WHERE pintura_tipo IS NOT NULL;

CREATE OR REPLACE FUNCTION public.atualizar_updated_at_preset_pintura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_producao_presets_pintura_updated_at
  ON public.producao_presets_pintura;
CREATE TRIGGER trg_producao_presets_pintura_updated_at
BEFORE UPDATE ON public.producao_presets_pintura
FOR EACH ROW EXECUTE FUNCTION public.atualizar_updated_at_preset_pintura();

CREATE OR REPLACE FUNCTION public.salvar_preset_pintura_producao(
  p_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_comprimento_ripa_m NUMERIC DEFAULT 2.000,
  p_largura_ripa_cm NUMERIC DEFAULT 4.000,
  p_ripas_por_painel NUMERIC DEFAULT 25.000,
  p_consumo_miolo_ml_por_ripa NUMERIC DEFAULT 6.7000,
  p_consumo_casca_ml_por_ripa NUMERIC DEFAULT 4.3160,
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para configurar presets de pintura';
  END IF;

  IF BTRIM(COALESCE(p_nome,'')) = '' THEN
    RAISE EXCEPTION 'Informe o nome do preset';
  END IF;

  IF COALESCE(p_comprimento_ripa_m,0) <= 0
     OR COALESCE(p_largura_ripa_cm,0) <= 0
     OR COALESCE(p_ripas_por_painel,0) <= 0
     OR COALESCE(p_consumo_miolo_ml_por_ripa,0) <= 0
     OR COALESCE(p_consumo_casca_ml_por_ripa,0) <= 0 THEN
    RAISE EXCEPTION 'Todos os parâmetros técnicos do preset devem ser maiores que zero';
  END IF;

  v_nome_usuario := public.nome_usuario_producao(v_user);

  IF p_id IS NULL THEN
    INSERT INTO public.producao_presets_pintura (
      nome,
      comprimento_ripa_m,
      largura_ripa_cm,
      ripas_por_painel,
      consumo_miolo_ml_por_ripa,
      consumo_casca_ml_por_ripa,
      ativo,
      criado_por_id,
      criado_por_nome_snapshot,
      atualizado_por_id,
      atualizado_por_nome_snapshot
    ) VALUES (
      BTRIM(p_nome),
      p_comprimento_ripa_m,
      p_largura_ripa_cm,
      p_ripas_por_painel,
      p_consumo_miolo_ml_por_ripa,
      p_consumo_casca_ml_por_ripa,
      COALESCE(p_ativo, TRUE),
      v_user,
      v_nome_usuario,
      v_user,
      v_nome_usuario
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.producao_presets_pintura
       SET nome = BTRIM(p_nome),
           comprimento_ripa_m = p_comprimento_ripa_m,
           largura_ripa_cm = p_largura_ripa_cm,
           ripas_por_painel = p_ripas_por_painel,
           consumo_miolo_ml_por_ripa = p_consumo_miolo_ml_por_ripa,
           consumo_casca_ml_por_ripa = p_consumo_casca_ml_por_ripa,
           ativo = COALESCE(p_ativo, TRUE),
           atualizado_por_id = v_user,
           atualizado_por_nome_snapshot = v_nome_usuario,
           updated_at = NOW()
     WHERE id = p_id
     RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Preset de pintura não encontrado';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_preset_pintura_producao(
  UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_preset_pintura_producao(
  UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,NUMERIC,BOOLEAN
) TO authenticated;

DROP FUNCTION IF EXISTS public.criar_ordem_producao(
  UUID,NUMERIC,DATE,DATE,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,TEXT
);

CREATE FUNCTION public.criar_ordem_producao(
  p_processo_id UUID,
  p_quantidade_planejada NUMERIC,
  p_data_inicio_prevista DATE,
  p_data_fim_prevista DATE,
  p_local_tipo TEXT,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_equipe_prevista INTEGER DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_pintura_tipo TEXT DEFAULT NULL,
  p_pintura_preset_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_processo public.producao_processos%ROWTYPE;
  v_preset public.producao_presets_pintura%ROWTYPE;
  v_id UUID;
  v_alocado NUMERIC;
  v_tipo TEXT := NULLIF(BTRIM(COALESCE(p_pintura_tipo,'')), '');
  v_consumo_ml_por_ripa NUMERIC;
  v_quantidade_ripas NUMERIC;
  v_consumo_ml_por_unidade NUMERIC;
  v_consumo_total_ml NUMERIC;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordens de Produção';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF p_data_inicio_prevista IS NULL
     OR p_data_fim_prevista IS NULL
     OR p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'Informe um período planejado válido para a OP';
  END IF;

  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;

  IF p_prioridade NOT IN ('baixa','normal','alta','urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_equipe_prevista IS NOT NULL AND p_equipe_prevista < 0 THEN
    RAISE EXCEPTION 'Equipe prevista inválida';
  END IF;

  IF v_tipo IS NOT NULL AND v_tipo NOT IN ('miolo','casca','painel') THEN
    RAISE EXCEPTION 'Tipo de pintura inválido';
  END IF;

  SELECT *
    INTO v_processo
    FROM public.producao_processos
   WHERE id = p_processo_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF v_processo.status IN ('finalizado','cancelado') THEN
    RAISE EXCEPTION 'Não é possível emitir OP para uma etapa encerrada';
  END IF;

  SELECT COALESCE(SUM(o.quantidade_planejada), 0)
    INTO v_alocado
    FROM public.producao_ordens_producao o
   WHERE o.processo_id = p_processo_id
     AND o.status <> 'cancelada';

  IF COALESCE(v_processo.quantidade_planejada, 0) > 0
     AND v_alocado + p_quantidade_planejada > v_processo.quantidade_planejada THEN
    RAISE EXCEPTION
      'A quantidade das OPs ultrapassa a quantidade planejada da etapa. Saldo disponível: %',
      GREATEST(v_processo.quantidade_planejada - v_alocado, 0);
  END IF;

  IF v_tipo IS NOT NULL THEN
    IF p_pintura_preset_id IS NULL THEN
      RAISE EXCEPTION 'Selecione o preset técnico de pintura';
    END IF;

    SELECT *
      INTO v_preset
      FROM public.producao_presets_pintura
     WHERE id = p_pintura_preset_id
       AND ativo = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Preset de pintura não encontrado ou inativo';
    END IF;

    v_consumo_ml_por_ripa := CASE
      WHEN v_tipo = 'miolo' THEN v_preset.consumo_miolo_ml_por_ripa
      ELSE v_preset.consumo_casca_ml_por_ripa
    END;

    v_quantidade_ripas := CASE
      WHEN v_tipo = 'painel' THEN p_quantidade_planejada * v_preset.ripas_por_painel
      ELSE p_quantidade_planejada
    END;

    v_consumo_ml_por_unidade := CASE
      WHEN v_tipo = 'painel' THEN v_preset.ripas_por_painel * v_consumo_ml_por_ripa
      ELSE v_consumo_ml_por_ripa
    END;

    v_consumo_total_ml := v_quantidade_ripas * v_consumo_ml_por_ripa;
  ELSIF p_pintura_preset_id IS NOT NULL THEN
    RAISE EXCEPTION 'Informe o tipo de pintura para utilizar um preset';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_ordens_producao (
    processo_id,
    projeto_id,
    local_tipo,
    descricao,
    instrucoes,
    produto_entregavel,
    unidade_medida,
    quantidade_planejada,
    data_inicio_prevista,
    data_fim_prevista,
    responsavel_id,
    responsavel_nome_snapshot,
    equipe_prevista,
    prioridade,
    status,
    criado_por_id,
    criado_por_nome_snapshot,
    pintura_tipo,
    pintura_preset_id,
    pintura_preset_nome_snapshot,
    pintura_comprimento_ripa_m_snapshot,
    pintura_largura_ripa_cm_snapshot,
    pintura_ripas_por_painel_snapshot,
    pintura_consumo_ml_por_ripa_snapshot,
    pintura_quantidade_ripas_calculada,
    pintura_consumo_ml_por_unidade,
    pintura_consumo_total_ml
  ) VALUES (
    v_processo.id,
    v_processo.projeto_id,
    p_local_tipo,
    NULLIF(BTRIM(p_descricao), ''),
    NULLIF(BTRIM(p_instrucoes), ''),
    v_processo.produto_entregavel,
    v_processo.unidade_medida,
    p_quantidade_planejada,
    p_data_inicio_prevista,
    p_data_fim_prevista,
    p_responsavel_id,
    NULLIF(BTRIM(p_responsavel_nome), ''),
    p_equipe_prevista,
    p_prioridade,
    'liberada',
    v_user,
    v_nome,
    v_tipo,
    CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.id END,
    CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.nome END,
    CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.comprimento_ripa_m END,
    CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.largura_ripa_cm END,
    CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.ripas_por_painel END,
    v_consumo_ml_por_ripa,
    v_quantidade_ripas,
    v_consumo_ml_por_unidade,
    v_consumo_total_ml
  )
  RETURNING id INTO v_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    dados
  ) VALUES (
    v_id,
    'op_emitida',
    'liberada',
    v_user,
    v_nome,
    JSONB_BUILD_OBJECT(
      'quantidade_planejada', p_quantidade_planejada,
      'data_inicio_prevista', p_data_inicio_prevista,
      'data_fim_prevista', p_data_fim_prevista,
      'pintura_tipo', v_tipo,
      'pintura_preset_id', CASE WHEN v_tipo IS NULL THEN NULL ELSE v_preset.id END,
      'pintura_quantidade_ripas_calculada', v_quantidade_ripas,
      'pintura_consumo_total_ml', v_consumo_total_ml
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_ordem_producao(
  UUID,NUMERIC,DATE,DATE,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_ordem_producao(
  UUID,NUMERIC,DATE,DATE,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,TEXT,TEXT,UUID
) TO authenticated;

DROP FUNCTION IF EXISTS public.listar_ordens_producao(UUID, TEXT);

CREATE FUNCTION public.listar_ordens_producao(
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
  updated_at TIMESTAMPTZ,
  pintura_tipo TEXT,
  pintura_preset_id UUID,
  pintura_preset_nome_snapshot TEXT,
  pintura_comprimento_ripa_m_snapshot NUMERIC,
  pintura_largura_ripa_cm_snapshot NUMERIC,
  pintura_ripas_por_painel_snapshot NUMERIC,
  pintura_consumo_ml_por_ripa_snapshot NUMERIC,
  pintura_quantidade_ripas_calculada NUMERIC,
  pintura_consumo_ml_por_unidade NUMERIC,
  pintura_consumo_total_ml NUMERIC
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
    o.local_tipo,
    o.descricao,
    o.instrucoes,
    o.produto_entregavel,
    o.unidade_medida,
    o.quantidade_planejada,
    COALESCE(a.realizado, 0),
    CASE
      WHEN o.quantidade_planejada > 0 THEN
        LEAST(100, ROUND((COALESCE(a.realizado,0) / o.quantidade_planejada) * 100, 2))
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
    o.updated_at,
    o.pintura_tipo,
    o.pintura_preset_id,
    o.pintura_preset_nome_snapshot,
    o.pintura_comprimento_ripa_m_snapshot,
    o.pintura_largura_ripa_cm_snapshot,
    o.pintura_ripas_por_painel_snapshot,
    o.pintura_consumo_ml_por_ripa_snapshot,
    o.pintura_quantidade_ripas_calculada,
    o.pintura_consumo_ml_por_unidade,
    o.pintura_consumo_total_ml
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id = o.processo_id
  JOIN public.producao_projetos pr ON pr.id = o.projeto_id
  LEFT JOIN (
    SELECT ordem_producao_id, SUM(COALESCE(quantidade_produzida,0)) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ) a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND (p_processo_id IS NULL OR o.processo_id = p_processo_id)
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.numero;
$$;

REVOKE ALL ON FUNCTION public.listar_ordens_producao(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_ordens_producao(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.producao_presets_pintura IS
  'Presets técnicos independentes do painel para calcular automaticamente tinta em OPs de miolo, casca e painel.';
COMMENT ON COLUMN public.producao_ordens_producao.pintura_consumo_total_ml IS
  'Consumo total previsto de tinta em mL, calculado automaticamente na emissão da OP e preservado como snapshot.';

NOTIFY pgrst, 'reload schema';

COMMIT;
