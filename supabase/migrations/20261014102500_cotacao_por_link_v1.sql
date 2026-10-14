BEGIN;

ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS url_origem text,
  ADD COLUMN IF NOT EXISTS plataforma_origem text,
  ADD COLUMN IF NOT EXISTS consultado_em timestamptz;

ALTER TABLE public.cotacoes
  DROP CONSTRAINT IF EXISTS cotacoes_origem_cadastro_check;

ALTER TABLE public.cotacoes
  ADD CONSTRAINT cotacoes_origem_cadastro_check
  CHECK (origem_cadastro IN ('manual','pdf','link'));

COMMIT;