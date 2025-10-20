-- Remove o campo status da tabela solicitacoes
ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS status;

-- Remove os campos relacionados à aprovação
ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS data_aprovacao;
ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS aprovado_por_id;
ALTER TABLE public.solicitacoes DROP COLUMN IF EXISTS aprovado_por_nome;