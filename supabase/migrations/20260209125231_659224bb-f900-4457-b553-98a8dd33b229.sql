
-- Sequência para número do pedido
CREATE SEQUENCE IF NOT EXISTS pedidos_compra_numero_seq START 1;

-- Tabela principal de pedidos de compra
CREATE TABLE public.pedidos_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero BIGINT NOT NULL DEFAULT nextval('pedidos_compra_numero_seq'::regclass),
  status TEXT NOT NULL DEFAULT 'aberto',
  observacoes TEXT,
  criado_por_id UUID,
  criado_por_nome TEXT NOT NULL,
  estoque_id UUID REFERENCES public.estoques(id),
  data_pedido TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de itens do pedido de compra
CREATE TABLE public.pedido_compra_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantidade NUMERIC NOT NULL,
  item_snapshot JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_compra_itens ENABLE ROW LEVEL SECURITY;

-- Policies for pedidos_compra
CREATE POLICY "Usuários autenticados podem ver pedidos" ON public.pedidos_compra
  FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Usuários com permissão podem criar pedidos" ON public.pedidos_compra
  FOR INSERT WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores podem atualizar pedidos" ON public.pedidos_compra
  FOR UPDATE USING (can_manage_inventory());

CREATE POLICY "Admins podem deletar pedidos" ON public.pedidos_compra
  FOR DELETE USING (is_admin());

-- Policies for pedido_compra_itens
CREATE POLICY "Usuários autenticados podem ver itens do pedido" ON public.pedido_compra_itens
  FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "Usuários com permissão podem criar itens do pedido" ON public.pedido_compra_itens
  FOR INSERT WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores podem atualizar itens do pedido" ON public.pedido_compra_itens
  FOR UPDATE USING (can_manage_inventory());

CREATE POLICY "Admins podem deletar itens do pedido" ON public.pedido_compra_itens
  FOR DELETE USING (is_admin());

-- Triggers para updated_at
CREATE TRIGGER update_pedidos_compra_updated_at
  BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_pedido_compra_itens_updated_at
  BEFORE UPDATE ON public.pedido_compra_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
