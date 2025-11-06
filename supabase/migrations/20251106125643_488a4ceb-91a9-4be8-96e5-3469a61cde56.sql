-- Remover coluna redundante data_criacao da tabela items
-- A coluna created_at já serve para este propósito
ALTER TABLE public.items DROP COLUMN IF EXISTS data_criacao;