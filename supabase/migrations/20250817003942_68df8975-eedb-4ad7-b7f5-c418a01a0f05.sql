-- CRITICAL SECURITY FIXES

-- 1. Fix profiles RLS policies - restrict SELECT access
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;

-- Only allow users to view their own profile + admins/gestors can view all
CREATE POLICY "Users can view own profile, admins view all"
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id OR is_gestor_or_admin());

-- 2. Prevent privilege escalation - secure role assignment
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and gestor can update any profile" ON public.profiles;

-- New secure policies
CREATE POLICY "Users can create profile with default role only"
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  tipo_usuario = 'estoquista'  -- Force default role
);

CREATE POLICY "Admins can update any profile, users can update own non-role fields"
ON public.profiles 
FOR UPDATE 
USING (
  (is_gestor_or_admin()) OR 
  (auth.uid() = user_id AND OLD.tipo_usuario = NEW.tipo_usuario)  -- Prevent self role change
);

-- 3. Create trigger to prevent role escalation via direct DB access
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only admins/gestors can change roles
  IF OLD.tipo_usuario != NEW.tipo_usuario AND NOT is_gestor_or_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to change user role';
  END IF;
  
  -- Prevent non-admins from creating admin/gestor accounts
  IF TG_OP = 'INSERT' AND NEW.tipo_usuario IN ('administrador', 'gestor') AND NOT is_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions to create privileged account';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();

-- 4. Add update triggers for better auditing
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();