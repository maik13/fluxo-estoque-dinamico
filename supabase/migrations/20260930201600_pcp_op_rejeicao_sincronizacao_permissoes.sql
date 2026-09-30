revoke execute on function public.sincronizar_materiais_ordem_producao(uuid) from public, anon;
grant execute on function public.sincronizar_materiais_ordem_producao(uuid) to authenticated;

revoke execute on function public.incorporar_materiais_pcp_op(uuid) from public, anon;
grant execute on function public.incorporar_materiais_pcp_op(uuid) to authenticated;
