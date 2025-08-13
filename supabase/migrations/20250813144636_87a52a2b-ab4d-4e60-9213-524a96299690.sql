-- Fix security vulnerability: Replace unrestricted RLS policies with proper authentication checks
-- Only authenticated users should be able to access inventory data

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "items_read_all_auth" ON public.items;
DROP POLICY IF EXISTS "items_write_all_auth" ON public.items;
DROP POLICY IF EXISTS "items_update_all_auth" ON public.items;
DROP POLICY IF EXISTS "items_delete_all_auth" ON public.items;

DROP POLICY IF EXISTS "movements_read_all_auth" ON public.movements;
DROP POLICY IF EXISTS "movements_write_all_auth" ON public.movements;
DROP POLICY IF EXISTS "movements_update_all_auth" ON public.movements;
DROP POLICY IF EXISTS "movements_delete_all_auth" ON public.movements;

-- Create secure policies that require authentication
-- Items table policies
CREATE POLICY "Items can be viewed by authenticated users" 
ON public.items 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Items can be created by authenticated users" 
ON public.items 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Items can be updated by authenticated users" 
ON public.items 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Items can be deleted by authenticated users" 
ON public.items 
FOR DELETE 
TO authenticated
USING (true);

-- Movements table policies  
CREATE POLICY "Movements can be viewed by authenticated users" 
ON public.movements 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Movements can be created by authenticated users" 
ON public.movements 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Movements can be updated by authenticated users" 
ON public.movements 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Movements can be deleted by authenticated users" 
ON public.movements 
FOR DELETE 
TO authenticated
USING (true);