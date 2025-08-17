-- First, let's create security definer functions to avoid infinite recursion in RLS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT tipo_usuario FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() = 'administrador';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_gestor_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_manage_inventory()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor', 'estoquista', 'mestre');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_create_items()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor', 'engenharia');
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Profiles can be viewed by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be created by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be updated by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles can be deleted by authenticated users" ON public.profiles;

DROP POLICY IF EXISTS "Items can be viewed by authenticated users" ON public.items;
DROP POLICY IF EXISTS "Items can be created by authenticated users" ON public.items;
DROP POLICY IF EXISTS "Items can be updated by authenticated users" ON public.items;
DROP POLICY IF EXISTS "Items can be deleted by authenticated users" ON public.items;

DROP POLICY IF EXISTS "Movements can be viewed by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Movements can be created by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Movements can be updated by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Movements can be deleted by authenticated users" ON public.movements;

-- Create proper role-based policies for PROFILES table
CREATE POLICY "All authenticated users can view profiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and gestor can update any profile"
ON public.profiles FOR UPDATE
USING (is_gestor_or_admin() OR auth.uid() = user_id);

CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
USING (is_admin());

-- Create proper role-based policies for ITEMS table
CREATE POLICY "All authenticated users can view items"
ON public.items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authorized users can create items"
ON public.items FOR INSERT
WITH CHECK (can_create_items());

CREATE POLICY "Inventory managers can update items"
ON public.items FOR UPDATE
USING (can_manage_inventory());

CREATE POLICY "Only admins and gestors can delete items"
ON public.items FOR DELETE
USING (is_gestor_or_admin());

-- Create proper role-based policies for MOVEMENTS table
CREATE POLICY "All authenticated users can view movements"
ON public.movements FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Inventory managers can create movements"
ON public.movements FOR INSERT
WITH CHECK (can_manage_inventory());

CREATE POLICY "Inventory managers can update movements"
ON public.movements FOR UPDATE
USING (can_manage_inventory());

CREATE POLICY "Only admins can delete movements"
ON public.movements FOR DELETE
USING (is_admin());