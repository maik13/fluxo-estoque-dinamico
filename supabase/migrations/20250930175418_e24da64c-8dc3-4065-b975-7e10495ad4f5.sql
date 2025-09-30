-- Adicionar campos na tabela de solicitações
ALTER TABLE public.solicitacoes 
ADD COLUMN IF NOT EXISTS responsavel_estoque text,
ADD COLUMN IF NOT EXISTS tipo_operacao text DEFAULT 'saida_producao';

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.solicitacoes.responsavel_estoque IS 'Responsável pelo estoque que fará a separação';
COMMENT ON COLUMN public.solicitacoes.tipo_operacao IS 'Tipo de operação: compra, saida_producao, quebra, devolucao, etc';