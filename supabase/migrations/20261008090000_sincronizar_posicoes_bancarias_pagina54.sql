-- Materializa, por conta bancária, os saldos que vêm nas colunas M:U da
-- Página54. A fonte permanece sendo a planilha piloto integrada.

CREATE OR REPLACE FUNCTION public.financeiro_pagina54_atualizar_posicoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date;
BEGIN
  IF NEW.spreadsheet_id <> '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA'
     OR NEW.aba <> 'Página54' THEN
    RETURN NEW;
  END IF;

  v_data := public.financeiro_parse_data_br(NEW.data_posicao_original);

  IF v_data IS NULL THEN
    RETURN NEW;
  END IF;

  WITH saldos(nome_conta, saldo) AS (
    VALUES
      ('Inter', public.financeiro_parse_moeda_br(NEW.inter_original)),
      ('Inter: Investimentos', public.financeiro_parse_moeda_br(NEW.inter_invest_original)),
      ('Sicoob', public.financeiro_parse_moeda_br(NEW.sicoob_original)),
      ('Sicoob: Investimentos', public.financeiro_parse_moeda_br(NEW.sicoob_invest_original)),
      ('Sicredi', public.financeiro_parse_moeda_br(NEW.sicredi_original)),
      ('BB', public.financeiro_parse_moeda_br(NEW.bb_original)),
      ('BB: Rende Fácil', public.financeiro_parse_moeda_br(NEW.bb_invest_original))
  )
  INSERT INTO public.financeiro_posicoes_diarias(
    data,
    conta_bancaria_id,
    responsavel,
    saldo_inicial_bancario,
    entradas_realizadas,
    saidas_realizadas,
    saldo_final_bancario,
    pagamentos_programados_nao_liquidados,
    recebimentos_previstos_nao_realizados,
    saidas_nao_previstas_diferencas,
    saldo_financeiro_gerencial,
    pendencias_proximo_dia
  )
  SELECT
    v_data,
    conta.id,
    'Importação Página54',
    saldos.saldo,
    0,
    0,
    saldos.saldo,
    0,
    0,
    0,
    saldos.saldo,
    NULL
  FROM saldos
  JOIN public.financeiro_contas_bancarias conta
    ON conta.nome = saldos.nome_conta
  WHERE saldos.saldo IS NOT NULL
  ON CONFLICT (data, conta_bancaria_id) DO UPDATE SET
    saldo_final_bancario = EXCLUDED.saldo_final_bancario,
    saldo_financeiro_gerencial = EXCLUDED.saldo_financeiro_gerencial,
    responsavel = 'Importação Página54',
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_pagina54_atualizar_posicoes
  ON public.financeiro_importacao_pagina54;

CREATE TRIGGER trg_financeiro_pagina54_atualizar_posicoes
AFTER INSERT OR UPDATE OF
  data_posicao_original,
  inter_original,
  inter_invest_original,
  sicoob_original,
  sicoob_invest_original,
  sicredi_original,
  bb_original,
  bb_invest_original
ON public.financeiro_importacao_pagina54
FOR EACH ROW
EXECUTE FUNCTION public.financeiro_pagina54_atualizar_posicoes();

-- Materializa também as posições que já chegaram antes deste ajuste.
UPDATE public.financeiro_importacao_pagina54
SET sync_em = sync_em
WHERE spreadsheet_id = '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA'
  AND aba = 'Página54'
  AND public.financeiro_parse_data_br(data_posicao_original) IS NOT NULL;
