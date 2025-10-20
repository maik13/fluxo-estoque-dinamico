-- Limpar dados existentes antes de alterar o tipo
TRUNCATE TABLE movements CASCADE;
TRUNCATE TABLE solicitacao_itens CASCADE;
TRUNCATE TABLE items CASCADE;

-- Alterar o tipo de dado da coluna codigo_barras de text para bigint
ALTER TABLE items 
ALTER COLUMN codigo_barras TYPE bigint USING COALESCE(codigo_barras::bigint, 0);