-- Adiciona coluna solicitacao_id na tabela movements
ALTER TABLE public.movements 
ADD COLUMN solicitacao_id UUID REFERENCES public.solicitacoes(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_movements_solicitacao_id ON public.movements(solicitacao_id);