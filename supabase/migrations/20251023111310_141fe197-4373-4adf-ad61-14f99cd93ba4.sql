-- Criar tabela de subcategorias
CREATE TABLE IF NOT EXISTS public.subcategorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar subcategorias"
ON public.subcategorias
FOR SELECT
USING (true);

CREATE POLICY "Gestores e admins podem criar subcategorias"
ON public.subcategorias
FOR INSERT
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores e admins podem atualizar subcategorias"
ON public.subcategorias
FOR UPDATE
USING (can_manage_inventory());

CREATE POLICY "Gestores e admins podem deletar subcategorias"
ON public.subcategorias
FOR DELETE
USING (can_manage_inventory());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subcategorias_updated_at
BEFORE UPDATE ON public.subcategorias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();