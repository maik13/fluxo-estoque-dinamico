-- Remover trigger e função relacionados ao codigo_assinatura
DROP TRIGGER IF EXISTS trigger_atribuir_codigo_assinatura ON public.profiles;
DROP FUNCTION IF EXISTS public.atribuir_codigo_assinatura() CASCADE;
DROP FUNCTION IF EXISTS public.gerar_codigo_assinatura() CASCADE;

-- Remover coluna codigo_assinatura da tabela profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS codigo_assinatura;