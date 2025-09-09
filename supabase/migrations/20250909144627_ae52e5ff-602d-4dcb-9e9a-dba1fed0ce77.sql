-- Criar função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar tabela para solicitações de material
CREATE TABLE public.solicitacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitante_id UUID NOT NULL,
  solicitante_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada')),
  observacoes TEXT,
  data_solicitacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  aprovado_por_id UUID,
  aprovado_por_nome TEXT,
  aceite_separador BOOLEAN DEFAULT false,
  aceite_solicitante BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para itens da solicitação
CREATE TABLE public.solicitacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantidade_solicitada NUMERIC NOT NULL,
  quantidade_aprovada NUMERIC DEFAULT 0,
  item_snapshot JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_itens ENABLE ROW LEVEL SECURITY;

-- Policies para solicitacoes
CREATE POLICY "Usuários autenticados podem ver solicitações" 
ON public.solicitacoes 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Usuários autenticados podem criar solicitações" 
ON public.solicitacoes 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text AND solicitante_id = auth.uid());

CREATE POLICY "Gestores e admins podem atualizar solicitações" 
ON public.solicitacoes 
FOR UPDATE 
USING (can_manage_inventory());

-- Policies para solicitacao_itens
CREATE POLICY "Usuários autenticados podem ver itens de solicitação" 
ON public.solicitacao_itens 
FOR SELECT 
USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Usuários autenticados podem criar itens de solicitação" 
ON public.solicitacao_itens 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Gestores podem atualizar itens de solicitação" 
ON public.solicitacao_itens 
FOR UPDATE 
USING (can_manage_inventory());

-- Trigger para updated_at
CREATE TRIGGER update_solicitacoes_updated_at
BEFORE UPDATE ON public.solicitacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();