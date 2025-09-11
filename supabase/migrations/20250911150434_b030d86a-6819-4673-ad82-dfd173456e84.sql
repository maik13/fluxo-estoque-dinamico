-- Security fixes migration (corrected)

-- 1. Remove the master user auto-promotion trigger and function (using CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS public.handle_master_user() CASCADE;

-- 2. Create a more secure profile update policy that prevents users from changing their own role
-- First, drop the existing update policy
DROP POLICY IF EXISTS "Admins and gestor can update any profile" ON public.profiles;

-- Create new update policies with better security
-- Allow admins and gestors to update any profile except tipo_usuario changes require admin
CREATE POLICY "Managers can update profile info" 
ON public.profiles 
FOR UPDATE 
USING (is_gestor_or_admin())
WITH CHECK (
  -- Allow updating all fields except tipo_usuario for gestors
  -- Only admins can change tipo_usuario
  (is_admin() OR (
    is_gestor_or_admin() AND 
    -- Ensure tipo_usuario is not being changed by comparing with existing value
    tipo_usuario = (SELECT p.tipo_usuario FROM public.profiles p WHERE p.id = profiles.id)
  ))
);

-- Allow users to update only their own basic profile info (not tipo_usuario or ativo)
CREATE POLICY "Users can update own basic profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Prevent users from changing their own role or active status
  tipo_usuario = (SELECT p.tipo_usuario FROM public.profiles p WHERE p.id = profiles.id) AND
  ativo = (SELECT p.ativo FROM public.profiles p WHERE p.id = profiles.id)
);

-- 3. Make the profiles table more secure by ensuring critical fields cannot be null
-- This prevents potential security bypasses
ALTER TABLE public.profiles 
ALTER COLUMN user_id SET NOT NULL;

-- 4. Add a function to safely promote users to admin (removing hardcoded approach)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Only allow existing admins to promote other users
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only administrators can promote users';
    END IF;
    
    -- Find the target user
    SELECT u.id INTO target_user_id 
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    WHERE u.email = target_email;
    
    IF target_user_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET tipo_usuario = 'administrador'
        WHERE user_id = target_user_id;
    ELSE
        RAISE EXCEPTION 'User not found or has no profile';
    END IF;
END;
$$;