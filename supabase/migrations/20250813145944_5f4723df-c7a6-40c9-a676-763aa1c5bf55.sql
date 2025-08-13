-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  tipo_usuario TEXT NOT NULL DEFAULT 'estoquista',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Profiles can be viewed by authenticated users" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Profiles can be created by authenticated users" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Profiles can be updated by authenticated users" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Profiles can be deleted by authenticated users" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();