-- Limpar todos os registros da tabela solicitacao_itens primeiro (devido às foreign keys)
DELETE FROM public.solicitacao_itens;

-- Limpar todos os registros da tabela solicitacoes
DELETE FROM public.solicitacoes;

-- Limpar todos os registros da tabela movements
DELETE FROM public.movements;

-- Resetar as sequences para começar do 1 novamente
ALTER SEQUENCE solicitacoes_numero_seq RESTART WITH 1;