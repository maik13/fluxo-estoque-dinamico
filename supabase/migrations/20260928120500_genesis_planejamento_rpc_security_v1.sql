BEGIN;

REVOKE EXECUTE ON FUNCTION public.listar_planejamento_producao_v2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_reservas_acervo_v1() FROM anon;
REVOKE EXECUTE ON FUNCTION public.salvar_reserva_acervo_v1(uuid,uuid,uuid,numeric,date,date,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_reserva_acervo_v1(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vincular_programacao_planejamento_v1(uuid,uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.listar_programacao_diaria_integrada_v1(date,integer) FROM anon;

GRANT EXECUTE ON FUNCTION public.listar_planejamento_producao_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_reservas_acervo_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_reserva_acervo_v1(uuid,uuid,uuid,numeric,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva_acervo_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_programacao_planejamento_v1(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_programacao_diaria_integrada_v1(date,integer) TO authenticated;

COMMIT;
