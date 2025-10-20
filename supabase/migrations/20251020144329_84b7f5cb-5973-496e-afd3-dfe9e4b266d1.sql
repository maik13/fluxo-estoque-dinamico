-- Limpar todas as linhas das tabelas
-- Ordem é importante por causa das foreign keys

-- Limpar movements primeiro
TRUNCATE TABLE public.movements CASCADE;

-- Limpar solicitacao_itens
TRUNCATE TABLE public.solicitacao_itens CASCADE;

-- Limpar solicitacoes
TRUNCATE TABLE public.solicitacoes CASCADE;