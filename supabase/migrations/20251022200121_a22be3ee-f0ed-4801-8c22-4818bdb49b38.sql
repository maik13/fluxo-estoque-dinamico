-- Adicionar colunas NCM e Valor na tabela items
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS valor numeric;