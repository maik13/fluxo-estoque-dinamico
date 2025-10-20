-- Atualizar política RLS para permitir que todos usuários autenticados vejam informações básicas de outros usuários
-- Isso é necessário para preencher listas de seleção como "Solicitante"
DROP POLICY IF EXISTS "Users can view own profile or managers can view all" ON public.profiles;

CREATE POLICY "All authenticated users can view basic profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);