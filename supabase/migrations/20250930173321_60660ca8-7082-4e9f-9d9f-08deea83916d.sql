-- Adicionar campo tipo_item para diferenciar Insumo e Ferramenta
ALTER TABLE items ADD COLUMN tipo_item TEXT DEFAULT 'Insumo';

-- Criar sequência para código automático
CREATE SEQUENCE items_codigo_seq START WITH 1;

-- Função para gerar próximo código sequencial
CREATE OR REPLACE FUNCTION gerar_proximo_codigo()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  proximo_numero INTEGER;
  novo_codigo TEXT;
BEGIN
  -- Obter próximo número da sequência
  proximo_numero := nextval('items_codigo_seq');
  
  -- Formatar código com zeros à esquerda (ex: 000001, 000002, etc)
  novo_codigo := 'COD-' || LPAD(proximo_numero::TEXT, 6, '0');
  
  RETURN novo_codigo;
END;
$$;