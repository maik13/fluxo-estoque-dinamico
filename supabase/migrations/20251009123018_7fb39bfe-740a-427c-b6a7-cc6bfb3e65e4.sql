-- Adicionar coluna para vincular devolução à solicitação original
ALTER TABLE public.solicitacoes 
ADD COLUMN solicitacao_origem_id uuid REFERENCES public.solicitacoes(id) ON DELETE SET NULL;

-- Adicionar índice para melhorar performance
CREATE INDEX idx_solicitacoes_origem ON public.solicitacoes(solicitacao_origem_id);

-- Comentário explicativo
COMMENT ON COLUMN public.solicitacoes.solicitacao_origem_id IS 'ID da solicitação de retirada original quando tipo_operacao é devolução';