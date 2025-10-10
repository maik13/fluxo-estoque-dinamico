-- Adicionar coluna para código de assinatura na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN codigo_assinatura TEXT UNIQUE;

-- Criar função para gerar código único de 8 dígitos
CREATE OR REPLACE FUNCTION public.gerar_codigo_assinatura()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  novo_codigo TEXT;
  codigo_existe BOOLEAN;
BEGIN
  LOOP
    -- Gerar código de 8 dígitos numéricos
    novo_codigo := LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    
    -- Verificar se o código já existe
    SELECT EXISTS(SELECT 1 FROM profiles WHERE codigo_assinatura = novo_codigo) INTO codigo_existe;
    
    -- Se não existir, retornar o código
    IF NOT codigo_existe THEN
      RETURN novo_codigo;
    END IF;
  END LOOP;
END;
$$;

-- Criar trigger para gerar código automaticamente ao inserir novo profile
CREATE OR REPLACE FUNCTION public.atribuir_codigo_assinatura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Se código não foi fornecido, gerar automaticamente
  IF NEW.codigo_assinatura IS NULL THEN
    NEW.codigo_assinatura := gerar_codigo_assinatura();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_atribuir_codigo_assinatura
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.atribuir_codigo_assinatura();

-- Gerar códigos para perfis existentes que não têm código
UPDATE public.profiles
SET codigo_assinatura = gerar_codigo_assinatura()
WHERE codigo_assinatura IS NULL;