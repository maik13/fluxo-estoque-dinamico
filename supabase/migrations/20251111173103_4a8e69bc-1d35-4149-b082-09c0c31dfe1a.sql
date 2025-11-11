-- Adicionar campo destinatario nas tabelas solicitacoes e movements
ALTER TABLE public.solicitacoes 
ADD COLUMN destinatario TEXT;

ALTER TABLE public.movements 
ADD COLUMN destinatario TEXT;

COMMENT ON COLUMN public.solicitacoes.destinatario IS 'Nome da pessoa para quem o item está sendo direcionado/entregue';
COMMENT ON COLUMN public.movements.destinatario IS 'Nome da pessoa para quem o item foi direcionado/entregue';