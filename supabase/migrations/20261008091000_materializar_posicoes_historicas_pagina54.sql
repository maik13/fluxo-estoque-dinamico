-- Semear as posições que chegaram antes da criação do gatilho automático.
WITH fonte AS (
  SELECT DISTINCT ON (public.financeiro_parse_data_br(i.data_posicao_original))
    public.financeiro_parse_data_br(i.data_posicao_original) AS data,
    i.inter_original,
    i.inter_invest_original,
    i.sicoob_original,
    i.sicoob_invest_original,
    i.sicredi_original,
    i.bb_original,
    i.bb_invest_original
  FROM public.financeiro_importacao_pagina54 i
  WHERE i.spreadsheet_id = '1rbdYW0eFmVZr4BQ2l_Q3KFIRheaxQY8XR2HvGstLgPA'
    AND i.aba = 'Página54'
    AND public.financeiro_parse_data_br(i.data_posicao_original) IS NOT NULL
  ORDER BY public.financeiro_parse_data_br(i.data_posicao_original), i.linha DESC
), saldos AS (
  SELECT f.data, v.nome_conta, v.saldo
  FROM fonte f
  CROSS JOIN LATERAL (
    VALUES
      ('Inter', public.financeiro_parse_moeda_br(f.inter_original)),
      ('Inter: Investimentos', public.financeiro_parse_moeda_br(f.inter_invest_original)),
      ('Sicoob', public.financeiro_parse_moeda_br(f.sicoob_original)),
      ('Sicoob: Investimentos', public.financeiro_parse_moeda_br(f.sicoob_invest_original)),
      ('Sicredi', public.financeiro_parse_moeda_br(f.sicredi_original)),
      ('BB', public.financeiro_parse_moeda_br(f.bb_original)),
      ('BB: Rende Fácil', public.financeiro_parse_moeda_br(f.bb_invest_original))
  ) AS v(nome_conta, saldo)
  WHERE v.saldo IS NOT NULL
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
  s.data,
  conta.id,
  'Importação Página54',
  s.saldo,
  0,
  0,
  s.saldo,
  0,
  0,
  0,
  s.saldo,
  NULL
FROM saldos s
JOIN public.financeiro_contas_bancarias conta
  ON conta.nome = s.nome_conta
ON CONFLICT (data, conta_bancaria_id) DO UPDATE SET
  saldo_final_bancario = EXCLUDED.saldo_final_bancario,
  saldo_financeiro_gerencial = EXCLUDED.saldo_financeiro_gerencial,
  responsavel = 'Importação Página54',
  updated_at = now();
