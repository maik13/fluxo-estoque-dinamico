-- Normaliza a RPC de configuração de projetos da Produção.
--
-- Duas migrations anteriores criaram overloads de configurar_projeto_producao_v2
-- com o mesmo conjunto de parâmetros nomeados, porém em ordens diferentes.
-- O PostgREST pode considerar a chamada RPC ambígua quando recebe os argumentos
-- por nome. Mantemos somente a assinatura canônica mais recente.

BEGIN;

DROP FUNCTION IF EXISTS public.configurar_projeto_producao_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DATE,
  DATE,
  UUID,
  TEXT,
  BOOLEAN
);

-- Garante que a assinatura canônica permanece restrita a usuários autenticados.
REVOKE ALL ON FUNCTION public.configurar_projeto_producao_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  DATE,
  DATE,
  BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.configurar_projeto_producao_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  DATE,
  DATE,
  BOOLEAN
) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
