
BEGIN;

-- Integra a base importada da Página54 ao fluxo financeiro operacional,
-- mantendo a tabela de importação como trilha de auditoria invisível ao usuário.

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS importacao_pagina54_id UUID NULL REFERENCES public.financeiro_importacao_pagina54(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planilha_linha INTEGER NULL,
  ADD COLUMN IF NOT EXISTS situacao_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS descricao_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS debito_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS credito_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS saldo_original TEXT NULL,
  ADD COLUMN IF NOT EXISTS sinalizacao_cor TEXT NULL,
  ADD COLUMN IF NOT EXISTS revisao_pendente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivos_revisao JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_lancamentos_import54_uidx
  ON public.financeiro_lancamentos(importacao_pagina54_id)
  WHERE importacao_pagina54_id IS NOT NULL;

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT IF EXISTS financeiro_lancamentos_status_check;

ALTER TABLE public.financeiro_lancamentos
  ADD CONSTRAINT financeiro_lancamentos_status_check CHECK (
    status IN (
      'previsto','solicitado','em_cotacao','aguardando_aprovacao','aprovado',
      'comprometido','aguardando_vencimento','programado','pago','conciliado','cancelado'
    )
  );

CREATE OR REPLACE FUNCTION public.financeiro_parse_moeda_br(p_texto TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN RETURN NULL; END IF;
  v := regexp_replace(p_texto, '[^0-9,.-]', '', 'g');
  IF v = '' OR v = '-' THEN RETURN NULL; END IF;
  v := replace(v, '.', '');
  v := replace(v, ',', '.');
  RETURN v::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_parse_data_br(p_texto TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v DATE;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN RETURN NULL; END IF;
  v := to_date(p_texto, 'DD/MM/YYYY');
  IF to_char(v, 'DD/MM/YYYY') <> p_texto THEN RETURN NULL; END IF;
  RETURN v;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Fluxo de caixa: uma linha operacional para cada linha da planilha que contém
-- dados financeiros/descrição. O sinal do valor é preservado como efeito no saldo.
INSERT INTO public.financeiro_lancamentos(
  tipo, status, descricao, descricao_original,
  categoria, subcategoria, projeto_centro_custo,
  data_prevista, data_realizada, valor_previsto, valor_realizado,
  origem_tipo, observacoes,
  importacao_pagina54_id, planilha_linha, situacao_original,
  debito_original, credito_original, saldo_original,
  sinalizacao_cor, revisao_pendente, motivos_revisao
)
SELECT
  CASE
    WHEN COALESCE(public.financeiro_parse_moeda_br(i.credito_original), public.financeiro_parse_moeda_br(i.debito_original), 0) < 0
      THEN 'saida'
    ELSE 'entrada'
  END,
  CASE
    WHEN upper(btrim(COALESCE(i.situacao,''))) = 'PAGO' THEN 'pago'
    WHEN upper(btrim(COALESCE(i.situacao,''))) = 'AGUARDANDO VENCIMENTO' THEN 'aguardando_vencimento'
    WHEN upper(btrim(COALESCE(i.situacao,''))) = 'PREVISÃO' THEN 'previsto'
    ELSE 'previsto'
  END,
  COALESCE(NULLIF(i.descricao,''), 'Linha Página54 ' || i.linha || ' - sem descrição'),
  i.descricao,
  i.categoria_original,
  i.subcategoria_original,
  NULL,
  public.financeiro_parse_data_br(i.data_prevista_original),
  public.financeiro_parse_data_br(i.data_realizada_original),
  CASE
    WHEN upper(btrim(COALESCE(i.situacao,''))) = 'PAGO' THEN
      abs(COALESCE(public.financeiro_parse_moeda_br(i.credito_original), public.financeiro_parse_moeda_br(i.debito_original)))
    ELSE
      abs(COALESCE(public.financeiro_parse_moeda_br(i.credito_original), public.financeiro_parse_moeda_br(i.debito_original)))
  END,
  CASE
    WHEN upper(btrim(COALESCE(i.situacao,''))) = 'PAGO' THEN
      abs(COALESCE(public.financeiro_parse_moeda_br(i.credito_original), public.financeiro_parse_moeda_br(i.debito_original)))
    ELSE NULL
  END,
  'pagina54',
  i.anotacao,
  i.id,
  i.linha,
  i.situacao,
  i.debito_original,
  i.credito_original,
  i.saldo_original,
  i.sinalizacao_cor,
  i.revisao_pendente,
  i.motivos_revisao
FROM public.financeiro_importacao_pagina54 i
WHERE (
    i.descricao IS NOT NULL
    OR i.debito_original IS NOT NULL
    OR i.credito_original IS NOT NULL
    OR i.situacao IS NOT NULL
    OR i.data_prevista_original IS NOT NULL
    OR i.data_realizada_original IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos fl
    WHERE fl.importacao_pagina54_id = i.id
  );

-- Posição bancária: reproduz os saldos por conta presentes na planilha.
WITH fonte AS (
  SELECT
    i.id,
    public.financeiro_parse_data_br(i.data_posicao_original) AS data_posicao,
    i.inter_original,
    i.inter_invest_original,
    i.sicoob_original,
    i.sicoob_invest_original,
    i.sicredi_original,
    i.bb_original,
    i.bb_invest_original
  FROM public.financeiro_importacao_pagina54 i
  WHERE public.financeiro_parse_data_br(i.data_posicao_original) IS NOT NULL
),
expandida AS (
  SELECT f.data_posicao, c.id AS conta_id, c.nome,
    CASE c.nome
      WHEN 'Inter' THEN public.financeiro_parse_moeda_br(f.inter_original)
      WHEN 'Inter: Investimentos' THEN public.financeiro_parse_moeda_br(f.inter_invest_original)
      WHEN 'Sicoob' THEN public.financeiro_parse_moeda_br(f.sicoob_original)
      WHEN 'Sicoob: Investimentos' THEN public.financeiro_parse_moeda_br(f.sicoob_invest_original)
      WHEN 'Sicredi' THEN public.financeiro_parse_moeda_br(f.sicredi_original)
      WHEN 'BB' THEN public.financeiro_parse_moeda_br(f.bb_original)
      WHEN 'BB: Rende Fácil' THEN public.financeiro_parse_moeda_br(f.bb_invest_original)
    END AS saldo
  FROM fonte f
  CROSS JOIN public.financeiro_contas_bancarias c
  WHERE c.nome IN ('Inter','Inter: Investimentos','Sicoob','Sicoob: Investimentos','Sicredi','BB','BB: Rende Fácil')
)
INSERT INTO public.financeiro_posicoes_diarias(
  data, conta_bancaria_id, responsavel,
  saldo_inicial_bancario, entradas_realizadas, saidas_realizadas,
  saldo_final_bancario, pagamentos_programados_nao_liquidados,
  recebimentos_previstos_nao_realizados, saidas_nao_previstas_diferencas,
  saldo_financeiro_gerencial, pendencias_proximo_dia
)
SELECT
  e.data_posicao, e.conta_id, 'Importação Página54',
  COALESCE(e.saldo,0), 0, 0,
  COALESCE(e.saldo,0), 0, 0, 0,
  COALESCE(e.saldo,0), NULL
FROM expandida e
ON CONFLICT (data, conta_bancaria_id) DO UPDATE SET
  saldo_final_bancario = EXCLUDED.saldo_final_bancario,
  saldo_financeiro_gerencial = EXCLUDED.saldo_financeiro_gerencial,
  responsavel = 'Importação Página54',
  updated_at = now();

COMMIT;
