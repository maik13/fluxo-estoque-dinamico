-- Remover a política de INSERT existente que está muito restritiva
DROP POLICY IF EXISTS "Usuários autenticados podem criar solicitações" ON public.solicitacoes;

-- Criar nova política de INSERT que permite usuários autenticados criarem solicitações
-- sem a restrição de que solicitante_id deve ser igual a auth.uid()
CREATE POLICY "Usuários autenticados podem criar solicitações" 
ON public.solicitacoes 
FOR INSERT 
TO authenticated
WITH CHECK (true);