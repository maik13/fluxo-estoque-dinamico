CREATE TABLE IF NOT EXISTS public.financeiro_importacao_pagina54 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_titulo TEXT NULL,
  aba TEXT NOT NULL DEFAULT 'Página54',
  linha INTEGER NOT NULL,
  valor_a TEXT NULL,
  situacao TEXT NULL,
  data_prevista_original TEXT NULL,
  data_realizada_original TEXT NULL,
  descricao TEXT NULL,
  categoria_original TEXT NULL,
  subcategoria_original TEXT NULL,
  anotacao TEXT NULL,
  debito_original TEXT NULL,
  credito_original TEXT NULL,
  saldo_original TEXT NULL,
  resultado_original TEXT NULL,
  data_posicao_original TEXT NULL,
  saldo_dia_original TEXT NULL,
  inter_original TEXT NULL,
  inter_invest_original TEXT NULL,
  sicoob_original TEXT NULL,
  sicoob_invest_original TEXT NULL,
  sicredi_original TEXT NULL,
  bb_original TEXT NULL,
  bb_invest_original TEXT NULL,
  valores_originais JSONB NOT NULL DEFAULT '{}'::jsonb,
  cores_originais JSONB NOT NULL DEFAULT '{}'::jsonb,
  sinalizacao_cor TEXT NULL,
  revisao_pendente BOOLEAN NOT NULL DEFAULT false,
  motivos_revisao JSONB NOT NULL DEFAULT '[]'::jsonb,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spreadsheet_id, aba, linha)
);

ALTER TABLE public.financeiro_importacao_pagina54 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_import54_select ON public.financeiro_importacao_pagina54;
CREATE POLICY fin_import54_select ON public.financeiro_importacao_pagina54
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.permissao_individual_efetiva(auth.uid(),'pode_acessar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_aprovar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_programar_financeiro')
  OR public.permissao_individual_efetiva(auth.uid(),'pode_conciliar_financeiro')
);

DROP POLICY IF EXISTS fin_import54_write ON public.financeiro_importacao_pagina54;
CREATE POLICY fin_import54_write ON public.financeiro_importacao_pagina54
FOR ALL TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_gerenciar_financeiro'));

CREATE INDEX IF NOT EXISTS financeiro_import54_linha_idx
  ON public.financeiro_importacao_pagina54(spreadsheet_id, aba, linha);

CREATE INDEX IF NOT EXISTS financeiro_import54_revisao_idx
  ON public.financeiro_importacao_pagina54(revisao_pendente, sinalizacao_cor);
