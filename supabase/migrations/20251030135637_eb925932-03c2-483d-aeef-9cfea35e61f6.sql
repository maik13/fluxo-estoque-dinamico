-- Adicionar coluna estoque_id na tabela movements
ALTER TABLE public.movements
ADD COLUMN estoque_id uuid REFERENCES public.estoques(id);

-- Adicionar coluna estoque_id na tabela solicitacoes
ALTER TABLE public.solicitacoes
ADD COLUMN estoque_id uuid REFERENCES public.estoques(id);

-- Criar índices para melhor performance
CREATE INDEX idx_movements_estoque_id ON public.movements(estoque_id);
CREATE INDEX idx_solicitacoes_estoque_id ON public.solicitacoes(estoque_id);

-- Atualizar registros existentes com o estoque padrão (se houver)
UPDATE public.movements
SET estoque_id = (SELECT id FROM public.estoques WHERE nome = 'Almoxarifado Principal' LIMIT 1)
WHERE estoque_id IS NULL;

UPDATE public.solicitacoes
SET estoque_id = (SELECT id FROM public.estoques WHERE nome = 'Almoxarifado Principal' LIMIT 1)
WHERE estoque_id IS NULL;