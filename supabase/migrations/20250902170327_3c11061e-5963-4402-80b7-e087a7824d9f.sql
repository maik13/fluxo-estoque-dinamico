-- Função para resetar senha do usuário master
CREATE OR REPLACE FUNCTION public.reset_master_password()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Busca o user_id do master
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'maikom708@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- Atualiza a senha usando o hash correto para a senha '29052021'
        UPDATE auth.users 
        SET 
            encrypted_password = crypt('29052021', gen_salt('bf')),
            updated_at = now()
        WHERE id = target_user_id;
        
        -- Garante que o perfil está correto
        INSERT INTO public.profiles (user_id, email, nome, tipo_usuario, ativo)
        VALUES (target_user_id, 'maikom708@gmail.com', 'Master Admin', 'administrador', true)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            tipo_usuario = 'administrador',
            ativo = true,
            updated_at = now();
    END IF;
END;
$$;

-- Executa a função para resetar a senha
SELECT public.reset_master_password();