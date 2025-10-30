-- Atualizar usuário específico para administrador
UPDATE public.profiles 
SET tipo_usuario = 'administrador'
WHERE user_id = 'b7a0efe7-97b2-4fa7-86b4-d720afd63d9e';