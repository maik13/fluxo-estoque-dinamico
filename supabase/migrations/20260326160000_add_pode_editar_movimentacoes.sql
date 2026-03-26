
-- Adicionar coluna de permissão para editar movimentações
ALTER TABLE public.permissoes_tipo_usuario 
  ADD COLUMN IF NOT EXISTS pode_editar_movimentacoes boolean NOT NULL DEFAULT false;

-- Definir permissões padrão: Administrador e Gestor podem editar por padrão
UPDATE public.permissoes_tipo_usuario SET
  pode_editar_movimentacoes = true
WHERE tipo_usuario IN ('administrador', 'gestor');

-- Garantir que outros tipos de usuário tenham false (já é o default, mas para clareza)
UPDATE public.permissoes_tipo_usuario SET
  pode_editar_movimentacoes = false
WHERE tipo_usuario NOT IN ('administrador', 'gestor');
