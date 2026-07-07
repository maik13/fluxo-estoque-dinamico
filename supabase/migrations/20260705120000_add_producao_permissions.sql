-- Permissões aditivas do Módulo de Produção.
-- Nenhuma permissão existente é removida, renomeada ou alterada.

ALTER TABLE public.permissoes_tipo_usuario
  ADD COLUMN IF NOT EXISTS pode_apontar_producao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_conferir_producao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_ver_bi_producao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_configurar_producao boolean NOT NULL DEFAULT false;
