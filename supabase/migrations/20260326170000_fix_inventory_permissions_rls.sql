-- Fix RLS policies for permissoes_tipo_usuario table
-- The existing policy uses is_admin() which relies on a SECURITY DEFINER function.
-- We drop and recreate to ensure the policies are clean and consistent.

-- Drop existing policies
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar permissões" ON public.permissoes_tipo_usuario;
DROP POLICY IF EXISTS "Apenas admins podem modificar permissões" ON public.permissoes_tipo_usuario;

-- Recreate SELECT policy for all authenticated users
CREATE POLICY "Todos os usuários autenticados podem visualizar permissões"
ON public.permissoes_tipo_usuario
FOR SELECT
TO authenticated
USING (true);

-- Recreate INSERT policy (for upsert support) - only admins
CREATE POLICY "Apenas admins podem inserir permissões"
ON public.permissoes_tipo_usuario
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Recreate UPDATE policy - only admins
CREATE POLICY "Apenas admins podem atualizar permissões"
ON public.permissoes_tipo_usuario
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Recreate DELETE policy - only admins
CREATE POLICY "Apenas admins podem deletar permissões"
ON public.permissoes_tipo_usuario
FOR DELETE
TO authenticated
USING (public.is_admin());
