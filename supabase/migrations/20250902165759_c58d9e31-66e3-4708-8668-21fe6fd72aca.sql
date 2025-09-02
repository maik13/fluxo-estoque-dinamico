-- Corrige a função make_user_admin_by_email para ter search_path seguro
CREATE OR REPLACE FUNCTION public.make_user_admin_by_email(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Busca o user_id baseado no email na tabela auth.users
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = user_email;
    
    IF target_user_id IS NOT NULL THEN
        -- Insere ou atualiza o perfil como administrador
        INSERT INTO public.profiles (user_id, email, nome, tipo_usuario, ativo)
        VALUES (target_user_id, user_email, 'Master Admin', 'administrador', true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            tipo_usuario = 'administrador',
            ativo = true;
    END IF;
END;
$$;

-- Corrige a função handle_master_user para ter search_path seguro
CREATE OR REPLACE FUNCTION public.handle_master_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Se o email for o do master, torna administrador automaticamente
    IF NEW.email = 'maikom708@gmail.com' THEN
        INSERT INTO public.profiles (user_id, email, nome, tipo_usuario, ativo)
        VALUES (NEW.id, NEW.email, 'Master Admin', 'administrador', true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            tipo_usuario = 'administrador',
            ativo = true;
    END IF;
    
    RETURN NEW;
END;
$$;