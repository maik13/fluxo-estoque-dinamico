-- Atualizar todas as solicitações existentes para status 'aprovada'
UPDATE public.solicitacoes
SET 
  status = 'aprovada',
  data_aprovacao = COALESCE(data_aprovacao, now()),
  aceite_separador = true,
  aceite_solicitante = true
WHERE status = 'pendente';