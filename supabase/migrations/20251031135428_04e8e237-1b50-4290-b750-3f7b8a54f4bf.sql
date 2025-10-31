-- Adicionar coluna subcategoria_id na tabela items
ALTER TABLE public.items ADD COLUMN subcategoria_id uuid REFERENCES public.subcategorias(id);

-- Criar índice para melhorar performance nas consultas
CREATE INDEX idx_items_subcategoria_id ON public.items(subcategoria_id);

-- Comentário explicativo
COMMENT ON COLUMN public.items.subcategoria_id IS 'Referência ao ID da subcategoria na tabela subcategorias';