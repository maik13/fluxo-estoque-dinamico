-- Corrigir search_path da função de código sequencial
DROP FUNCTION IF EXISTS gerar_proximo_codigo();

CREATE OR REPLACE FUNCTION gerar_proximo_codigo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proximo_numero INTEGER;
  novo_codigo TEXT;
BEGIN
  -- Obter próximo número da sequência
  proximo_numero := nextval('items_codigo_seq');
  
  -- Formatar código com zeros à esquerda (ex: COD-000001, COD-000002, etc)
  novo_codigo := 'COD-' || LPAD(proximo_numero::TEXT, 6, '0');
  
  RETURN novo_codigo;
END;
$$;