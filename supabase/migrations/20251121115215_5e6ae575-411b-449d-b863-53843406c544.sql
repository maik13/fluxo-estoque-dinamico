-- Atualizar usuário marcelo@zampiericonsultoria.com.br para administrador
UPDATE public.profiles
SET tipo_usuario = 'administrador',
    ativo = true
WHERE email = 'marcelo@zampiericonsultoria.com.br';