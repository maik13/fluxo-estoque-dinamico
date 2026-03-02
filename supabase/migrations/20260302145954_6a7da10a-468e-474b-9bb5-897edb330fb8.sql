
-- Tornar item_id nullable em pedido_compra_itens para suportar itens avulsos
ALTER TABLE public.pedido_compra_itens ALTER COLUMN item_id DROP NOT NULL;

-- Adicionar nome do item avulso
ALTER TABLE public.pedido_compra_itens ADD COLUMN IF NOT EXISTS nome_item text;

-- Adicionar referência à solicitação de material no pedido de compra
ALTER TABLE public.pedidos_compra ADD COLUMN IF NOT EXISTS solicitacao_material_id uuid REFERENCES public.solicitacoes_material(id) ON DELETE SET NULL;

-- Adicionar referência ao número da solicitação para exibição
ALTER TABLE public.pedidos_compra ADD COLUMN IF NOT EXISTS solicitacao_material_numero bigint;
