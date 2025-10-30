-- Criar tabela de estoques
CREATE TABLE public.estoques (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Adicionar índice para busca por nome
CREATE INDEX idx_estoques_nome ON public.estoques(nome);

-- Habilitar Row Level Security
ALTER TABLE public.estoques ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Usuários autenticados podem visualizar estoques
CREATE POLICY "Usuários autenticados podem visualizar estoques"
ON public.estoques
FOR SELECT
USING (true);

-- Políticas RLS - Gestores e admins podem criar estoques
CREATE POLICY "Gestores e admins podem criar estoques"
ON public.estoques
FOR INSERT
WITH CHECK (can_manage_inventory());

-- Políticas RLS - Gestores e admins podem atualizar estoques
CREATE POLICY "Gestores e admins podem atualizar estoques"
ON public.estoques
FOR UPDATE
USING (can_manage_inventory());

-- Políticas RLS - Gestores e admins podem deletar estoques
CREATE POLICY "Gestores e admins podem deletar estoques"
ON public.estoques
FOR DELETE
USING (can_manage_inventory());

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_estoques_updated_at
BEFORE UPDATE ON public.estoques
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir estoque padrão
INSERT INTO public.estoques (nome, descricao, ativo)
VALUES ('Almoxarifado Principal', 'Almoxarifado principal do sistema', true);