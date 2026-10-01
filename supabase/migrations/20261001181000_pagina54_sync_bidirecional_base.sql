-- Base técnica da sincronização bidirecional Página54 ⇄ Financeiro.
-- Esta migration registra os campos e rotinas criados no banco de produção em 01/10/2026.

BEGIN;

ALTER TABLE public.financeiro_importacao_pagina54
  ADD COLUMN IF NOT EXISTS integracao_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS autor_ultima_alteracao TEXT NULL,
  ADD COLUMN IF NOT EXISTS origem_alteracao TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_atualizacao_planilha TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'importado',
  ADD COLUMN IF NOT EXISTS sync_erro TEXT NULL,
  ADD COLUMN IF NOT EXISTS sync_em TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financeiro_importacao_pagina54_integracao_uidx'
  ) THEN
    ALTER TABLE public.financeiro_importacao_pagina54
      ADD CONSTRAINT financeiro_importacao_pagina54_integracao_uidx
      UNIQUE (spreadsheet_id, aba, integracao_id);
  END IF;
END $$;

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS pagina54_integracao_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS pagina54_ultima_origem TEXT NULL,
  ADD COLUMN IF NOT EXISTS pagina54_autor_alteracao TEXT NULL,
  ADD COLUMN IF NOT EXISTS pagina54_ultima_atualizacao TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pagina54_sync_status TEXT NOT NULL DEFAULT 'nao_integrado',
  ADD COLUMN IF NOT EXISTS pagina54_sync_erro TEXT NULL,
  ADD COLUMN IF NOT EXISTS pagina54_sync_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pagina54_precisa_exportar BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_lancamentos_pagina54_integracao_uidx
  ON public.financeiro_lancamentos(pagina54_integracao_id)
  WHERE pagina54_integracao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS financeiro_lancamentos_pagina54_exportar_idx
  ON public.financeiro_lancamentos(pagina54_precisa_exportar, pagina54_sync_status)
  WHERE pagina54_integracao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.financeiro_parse_timestamp_pagina54(p_texto TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text TEXT;
BEGIN
  IF p_texto IS NULL OR btrim(p_texto) = '' THEN RETURN NULL; END IF;
  v_text := btrim(p_texto);
  BEGIN RETURN to_timestamp(v_text, 'DD/MM/YYYY HH24:MI:SS'); EXCEPTION WHEN others THEN NULL; END;
  BEGIN RETURN v_text::timestamptz; EXCEPTION WHEN others THEN RETURN NULL; END;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_pagina54_status(p_situacao TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE v TEXT;
BEGIN
  v := upper(btrim(COALESCE(p_situacao,'')));
  IF v = 'PAGO' THEN RETURN 'pago';
  ELSIF v = 'AGUARDANDO VENCIMENTO' THEN RETURN 'aguardando_vencimento';
  ELSIF v = 'PREVISÃO' OR v = 'PREVISAO' THEN RETURN 'previsto';
  ELSIF v = 'CANCELADO' THEN RETURN 'cancelado';
  ELSE RETURN 'previsto'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_pagina54_situacao(p_status TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE COALESCE(p_status,'')
    WHEN 'pago' THEN RETURN 'PAGO';
    WHEN 'conciliado' THEN RETURN 'PAGO';
    WHEN 'programado' THEN RETURN 'AGUARDANDO VENCIMENTO';
    WHEN 'aguardando_vencimento' THEN RETURN 'AGUARDANDO VENCIMENTO';
    WHEN 'cancelado' THEN RETURN 'CANCELADO';
    ELSE RETURN 'PREVISÃO';
  END CASE;
END;
$$;

-- Função completa aplicada em produção: public.financeiro_pagina54_receber_linha(...)
-- Ela recebe uma linha da Página54, registra auditoria na tabela financeiro_importacao_pagina54
-- e cria/atualiza o lançamento financeiro pelo ID Integração da coluna Y.

CREATE OR REPLACE FUNCTION public.financeiro_pagina54_marcar_exportacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.pagina54_integracao_id IS NOT NULL
     AND COALESCE(current_setting('app.pagina54_sync_import', true), '') <> 'on'
     AND (
       NEW.tipo IS DISTINCT FROM OLD.tipo OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.descricao IS DISTINCT FROM OLD.descricao OR
       NEW.categoria IS DISTINCT FROM OLD.categoria OR
       NEW.subcategoria IS DISTINCT FROM OLD.subcategoria OR
       NEW.data_prevista IS DISTINCT FROM OLD.data_prevista OR
       NEW.data_realizada IS DISTINCT FROM OLD.data_realizada OR
       NEW.valor_previsto IS DISTINCT FROM OLD.valor_previsto OR
       NEW.valor_realizado IS DISTINCT FROM OLD.valor_realizado OR
       NEW.observacoes IS DISTINCT FROM OLD.observacoes
     ) THEN
    NEW.pagina54_ultima_origem := 'SISTEMA';
    NEW.pagina54_ultima_atualizacao := now();
    NEW.pagina54_sync_status := 'pendente_exportacao';
    NEW.pagina54_sync_erro := NULL;
    NEW.pagina54_precisa_exportar := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pagina54_marcar_exportacao ON public.financeiro_lancamentos;
CREATE TRIGGER trg_financeiro_pagina54_marcar_exportacao
BEFORE UPDATE ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.financeiro_pagina54_marcar_exportacao();

CREATE OR REPLACE VIEW public.financeiro_pagina54_exportacao_pendente AS
SELECT
  fl.id AS lancamento_id,
  fl.pagina54_integracao_id AS integracao_id,
  fl.planilha_linha AS linha,
  public.financeiro_pagina54_situacao(fl.status) AS situacao,
  to_char(fl.data_prevista, 'DD/MM/YYYY') AS data_prevista,
  to_char(fl.data_realizada, 'DD/MM/YYYY') AS data_realizada,
  fl.descricao,
  fl.categoria,
  fl.subcategoria,
  fl.observacoes AS anotacao,
  CASE WHEN fl.tipo = 'saida' THEN to_char(COALESCE(fl.valor_realizado, fl.valor_previsto, 0), 'FM999999999990D00') ELSE NULL END AS debito,
  CASE WHEN fl.tipo = 'entrada' THEN to_char(COALESCE(fl.valor_realizado, fl.valor_previsto, 0), 'FM999999999990D00') ELSE NULL END AS credito,
  'SISTEMA'::TEXT AS origem_alteracao,
  to_char(COALESCE(fl.pagina54_ultima_atualizacao, now()), 'DD/MM/YYYY HH24:MI:SS') AS ultima_atualizacao
FROM public.financeiro_lancamentos fl
WHERE fl.pagina54_integracao_id IS NOT NULL
  AND fl.pagina54_precisa_exportar = true;

COMMIT;
