-- A função contém verificação interna de Produção e deve ser acessível somente após login.
REVOKE ALL ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_gantt_producao() FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;
