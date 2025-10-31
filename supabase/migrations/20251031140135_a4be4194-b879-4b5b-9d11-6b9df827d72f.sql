-- Adicionar coluna user_id na tabela movements
ALTER TABLE public.movements ADD COLUMN user_id uuid REFERENCES auth.users(id);

-- Criar índice para melhorar performance nas consultas
CREATE INDEX idx_movements_user_id ON public.movements(user_id);

-- Comentário explicativo
COMMENT ON COLUMN public.movements.user_id IS 'ID do usuário que realizou a movimentação';