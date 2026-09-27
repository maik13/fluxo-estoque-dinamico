BEGIN;

REVOKE ALL ON FUNCTION public.listar_planejamento_producao_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v1() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.atualizar_planejamento_projeto_v1(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_planejamento_projeto_v1(UUID, BOOLEAN) TO authenticated, service_role;

COMMIT;
