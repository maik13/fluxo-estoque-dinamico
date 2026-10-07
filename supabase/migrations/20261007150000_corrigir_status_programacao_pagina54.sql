-- A Página54 usa "AGUARDANDO VENCIMENTO" para pagamentos já programados.
-- Mantemos "pago" separado: pagamento realizado ainda segue para conciliação.
CREATE OR REPLACE FUNCTION public.financeiro_pagina54_status(p_situacao text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  v := upper(btrim(COALESCE(p_situacao, '')));

  IF v = 'PAGO' THEN
    RETURN 'pago';
  ELSIF v IN ('PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO', 'AGUARDANDO VENCIMENTO') THEN
    RETURN 'programado';
  ELSIF v IN ('PREVISÃO', 'PREVISAO') THEN
    RETURN 'previsto';
  ELSIF v = 'CANCELADO' THEN
    RETURN 'cancelado';
  ELSE
    RETURN 'previsto';
  END IF;
END;
$$;

-- Reclassifica somente lançamentos importados da Página54 que usam a situação
-- equivalente a programado. Não altera lançamentos nativos, RCs ou PNs.
UPDATE public.financeiro_lancamentos
SET status = 'programado',
    updated_at = now()
WHERE origem_tipo = 'pagina54'
  AND upper(btrim(COALESCE(situacao_original, ''))) IN (
    'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO', 'AGUARDANDO VENCIMENTO'
  )
  AND status NOT IN ('pago', 'conciliado', 'cancelado');
