-- Criar tabela de solicitantes
CREATE TABLE IF NOT EXISTS public.solicitantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  codigo_barras TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.solicitantes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para visualização (usuários autenticados)
CREATE POLICY "Usuários autenticados podem visualizar solicitantes"
ON public.solicitantes
FOR SELECT
TO authenticated
USING (true);

-- Políticas RLS para inserção (gestores e admins)
CREATE POLICY "Gestores e admins podem criar solicitantes"
ON public.solicitantes
FOR INSERT
TO authenticated
WITH CHECK (can_manage_inventory());

-- Políticas RLS para atualização (gestores e admins)
CREATE POLICY "Gestores e admins podem atualizar solicitantes"
ON public.solicitantes
FOR UPDATE
TO authenticated
USING (can_manage_inventory());

-- Políticas RLS para exclusão (gestores e admins)
CREATE POLICY "Gestores e admins podem deletar solicitantes"
ON public.solicitantes
FOR DELETE
TO authenticated
USING (can_manage_inventory());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_solicitantes_updated_at
BEFORE UPDATE ON public.solicitantes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();