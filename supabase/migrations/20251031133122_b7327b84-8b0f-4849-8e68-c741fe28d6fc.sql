-- Remover a geração automática do código de barras
-- Tornar o campo obrigatório sem valor padrão
ALTER TABLE items ALTER COLUMN codigo_barras DROP DEFAULT;