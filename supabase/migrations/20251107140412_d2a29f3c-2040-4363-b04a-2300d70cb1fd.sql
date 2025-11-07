-- Create transferencias table
CREATE TABLE public.transferencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estoque_origem_id uuid NOT NULL REFERENCES public.estoques(id),
  estoque_destino_id uuid NOT NULL REFERENCES public.estoques(id),
  user_id uuid NOT NULL,
  observacoes text,
  data_transferencia timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transferencias_estoques_diferentes CHECK (estoque_origem_id != estoque_destino_id)
);

-- Create transferencia_itens table to store items in each transfer
CREATE TABLE public.transferencia_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transferencia_id uuid NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  item_snapshot jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_itens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transferencias
CREATE POLICY "Usuários autenticados podem visualizar transferências"
ON public.transferencias
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários com permissão podem criar transferências"
ON public.transferencias
FOR INSERT
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores podem atualizar transferências"
ON public.transferencias
FOR UPDATE
USING (can_manage_inventory());

-- RLS Policies for transferencia_itens
CREATE POLICY "Usuários autenticados podem visualizar itens de transferência"
ON public.transferencia_itens
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários com permissão podem criar itens de transferência"
ON public.transferencia_itens
FOR INSERT
WITH CHECK (can_manage_inventory());

-- Create trigger for updated_at
CREATE TRIGGER update_transferencias_updated_at
BEFORE UPDATE ON public.transferencias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_transferencias_estoque_origem ON public.transferencias(estoque_origem_id);
CREATE INDEX idx_transferencias_estoque_destino ON public.transferencias(estoque_destino_id);
CREATE INDEX idx_transferencias_user ON public.transferencias(user_id);
CREATE INDEX idx_transferencia_itens_transferencia ON public.transferencia_itens(transferencia_id);