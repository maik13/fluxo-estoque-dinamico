-- Limpar dados das tabelas (deletar em ordem para evitar conflitos de FK)

-- Limpar itens de solicitação primeiro
DELETE FROM public.solicitacao_itens;

-- Limpar movimentações
DELETE FROM public.movements;

-- Limpar solicitações
DELETE FROM public.solicitacoes;

-- Limpar items
DELETE FROM public.items;

-- Resetar sequências se necessário
ALTER SEQUENCE IF EXISTS solicitacoes_numero_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS items_codigo_seq RESTART WITH 1;