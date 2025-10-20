-- Permitir que perfis com permissão de estoque possam inserir itens
DROP POLICY IF EXISTS "Authorized users can create items" ON public.items;

CREATE POLICY "Authorized users can create items"
ON public.items
FOR INSERT
TO authenticated
WITH CHECK (can_manage_inventory());