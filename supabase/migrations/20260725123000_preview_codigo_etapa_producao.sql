-- Exibe no formulário o próximo código automático previsto sem consumir a sequência.
-- O código definitivo continua sendo atribuído pelo banco ao salvar a etapa.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq;

CREATE OR REPLACE FUNCTION public.obter_proximo_codigo_etapa_producao()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_last BIGINT;
  v_is_called BOOLEAN;
  v_proximo BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT last_value, is_called
  INTO v_last, v_is_called
  FROM public.producao_processo_codigo_seq;

  v_proximo := CASE WHEN v_is_called THEN v_last + 1 ELSE v_last END;

  RETURN 'PRD-'
    || to_char(CURRENT_DATE, 'YYYY')
    || '-'
    || lpad(v_proximo::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.obter_proximo_codigo_etapa_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_proximo_codigo_etapa_producao() TO authenticated;

COMMIT;
