-- Fix search path security warnings by setting search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT tipo_usuario FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() = 'administrador';
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_gestor_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor');
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_inventory()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor', 'estoquista', 'mestre');
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_create_items()
RETURNS BOOLEAN AS $$
  SELECT get_current_user_role() IN ('administrador', 'gestor', 'engenharia');
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;