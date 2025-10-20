-- Limpar todas as linhas das tabelas
-- Ordem respeitando as foreign keys

-- Limpar movements primeiro (referencia items e solicitacoes)
TRUNCATE TABLE public.movements CASCADE;

-- Limpar solicitacao_itens (referencia solicitacoes e items)
TRUNCATE TABLE public.solicitacao_itens CASCADE;

-- Limpar solicitacoes
TRUNCATE TABLE public.solicitacoes CASCADE;

-- Limpar items por último
TRUNCATE TABLE public.items CASCADE;