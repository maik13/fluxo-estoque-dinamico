-- Remove a coluna quantidade da tabela items
-- O estoque atual é calculado dinamicamente através das movimentações
ALTER TABLE public.items 
DROP COLUMN IF EXISTS quantidade;