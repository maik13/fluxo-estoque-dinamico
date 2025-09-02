-- Função para tornar um usuário administrador baseado no email
CREATE OR REPLACE FUNCTION public.make_user_admin_by_email(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Trigger para automaticamente tornar o email específico administrador quando ele se cadastrar
CREATE OR REPLACE FUNCTION public.handle_master_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
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

-- Cria o trigger para usuários novos
DROP TRIGGER IF EXISTS on_auth_user_master_created ON auth.users;
CREATE TRIGGER on_auth_user_master_created
    AFTER INSERT ON auth.users
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_master_user();

-- Executa a função para o email especificado (caso já exista)
SELECT public.make_user_admin_by_email('maikom708@gmail.com');