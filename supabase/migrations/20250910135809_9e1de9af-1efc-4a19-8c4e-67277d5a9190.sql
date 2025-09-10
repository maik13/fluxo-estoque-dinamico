-- Adicionar campo local_utilizacao na tabela solicitacoes
ALTER TABLE public.solicitacoes 
ADD COLUMN local_utilizacao text;