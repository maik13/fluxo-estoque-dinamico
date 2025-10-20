-- Remove a coluna email da tabela solicitantes
ALTER TABLE public.solicitantes DROP COLUMN IF EXISTS email;