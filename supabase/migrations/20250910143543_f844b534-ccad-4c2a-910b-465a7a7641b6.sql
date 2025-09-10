-- Fix security issue: Restrict profile access
-- Users should only see their own profile unless they have management permissions

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.profiles;

-- Create a more secure policy that allows:
-- 1. Users to view their own profile
-- 2. Gestors and admins to view all profiles (for legitimate business purposes)
CREATE POLICY "Users can view own profile or managers can view all" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR is_gestor_or_admin()
);