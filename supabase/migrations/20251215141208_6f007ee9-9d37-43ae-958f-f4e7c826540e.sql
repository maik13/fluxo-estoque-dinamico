-- Criar tabela para configuração de permissões por tipo de usuário
CREATE TABLE public.permissoes_tipo_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_usuario text NOT NULL UNIQUE,
  pode_cadastrar_itens boolean NOT NULL DEFAULT false,
  pode_editar_itens boolean NOT NULL DEFAULT false,
  pode_excluir_itens boolean NOT NULL DEFAULT false,
  pode_registrar_movimentacoes boolean NOT NULL DEFAULT false,
  pode_gerenciar_configuracoes boolean NOT NULL DEFAULT false,
  pode_gerenciar_usuarios boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.permissoes_tipo_usuario ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar permissões"
ON public.permissoes_tipo_usuario
FOR SELECT
USING (true);

CREATE POLICY "Apenas admins podem modificar permissões"
ON public.permissoes_tipo_usuario
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Inserir configuração padrão para cada tipo de usuário
INSERT INTO public.permissoes_tipo_usuario (tipo_usuario, pode_cadastrar_itens, pode_editar_itens, pode_excluir_itens, pode_registrar_movimentacoes, pode_gerenciar_configuracoes, pode_gerenciar_usuarios)
VALUES 
  ('administrador', true, true, true, true, true, true),
  ('gestor', true, true, true, true, true, true),
  ('engenharia', true, true, false, false, false, false),
  ('mestre', false, false, false, true, false, false),
  ('estoquista', false, false, false, true, false, false);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_permissoes_tipo_usuario_updated_at
BEFORE UPDATE ON public.permissoes_tipo_usuario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Habilitar realtime
ALTER TABLE public.permissoes_tipo_usuario REPLICA IDENTITY FULL;