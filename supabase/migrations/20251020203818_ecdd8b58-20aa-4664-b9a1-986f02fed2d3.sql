-- Limpar todas as tabelas de solicitações e movimentações

-- Primeiro remover os itens das solicitações
DELETE FROM solicitacao_itens;

-- Depois remover as solicitações
DELETE FROM solicitacoes;

-- Por último remover as movimentações
DELETE FROM movements;

-- Resetar a sequência de numeração das solicitações
ALTER SEQUENCE solicitacoes_numero_seq RESTART WITH 1;