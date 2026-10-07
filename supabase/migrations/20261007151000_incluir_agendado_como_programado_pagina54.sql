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
  ELSIF v IN (
    'PROGRAMADO', 'PROGRAMAÇÃO', 'PROGRAMACAO',
    'AGENDADO', 'AGUARDANDO VENCIMENTO'
  ) THEN
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

UPDATE public.financeiro_lancamentos
SET status = 'programado',
    updated_at = now()
WHERE origem_tipo = 'pagina54'
  AND upper(btrim(COALESCE(situacao_original, ''))) = 'AGENDADO'
  AND status NOT IN ('pago', 'conciliado', 'cancelado');
