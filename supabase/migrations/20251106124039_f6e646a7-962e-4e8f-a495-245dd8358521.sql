-- Adicionar coluna codigo_antigo na tabela items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS codigo_antigo text;