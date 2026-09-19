BEGIN;

REVOKE ALL ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(UUID, TEXT)
  TO authenticated, service_role;

COMMIT;
