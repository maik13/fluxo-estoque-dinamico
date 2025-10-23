-- Adicionar coluna para registrar o usuário que criou a solicitação
ALTER TABLE public.solicitacoes 
ADD COLUMN criado_por_id uuid REFERENCES auth.users(id);

-- Comentário explicativo
COMMENT ON COLUMN public.solicitacoes.criado_por_id IS 'ID do usuário que criou/registrou a solicitação no sistema';