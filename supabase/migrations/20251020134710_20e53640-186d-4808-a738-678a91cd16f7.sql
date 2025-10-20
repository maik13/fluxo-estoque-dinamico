-- Função para criar perfil automaticamente ao fazer login
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil se não existir
  INSERT INTO public.profiles (user_id, nome, email, tipo_usuario, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    'estoquista', -- Tipo padrão
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Atualizar perfis existentes se necessário
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    INSERT INTO public.profiles (user_id, nome, email, tipo_usuario, ativo)
    VALUES (
      user_record.id,
      COALESCE(user_record.raw_user_meta_data->>'nome', user_record.email),
      user_record.email,
      'estoquista',
      true
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;