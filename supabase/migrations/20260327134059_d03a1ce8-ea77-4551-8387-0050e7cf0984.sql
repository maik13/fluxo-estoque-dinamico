ALTER TABLE public.permissoes_tipo_usuario 
ADD COLUMN IF NOT EXISTS pode_editar_movimentacoes boolean NOT NULL DEFAULT false;