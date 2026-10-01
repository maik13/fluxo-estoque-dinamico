create or replace function public.listar_painel_gerencial_producao_v2()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not (
   public.is_admin() or public.permissao_individual_efetiva(auth.uid(),'pode_ver_bi_producao')
   or public.usuario_tem_permissao_producao('visualizar')
 ) then raise exception 'Sem permissão para visualizar o Gerencial de Produção' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(painel) || jsonb_build_object(
   'cidade',nullif(btrim(p.cidade),''),'uf',nullif(btrim(p.uf),'')
 ) order by painel.projeto_nome,painel.projeto_id),'[]'::jsonb)
 into resultado from public.listar_painel_gerencial_producao_v1() painel
 join public.producao_projetos p on p.id=painel.projeto_id;
 return resultado;
end $$;
revoke all on function public.listar_painel_gerencial_producao_v2() from public,anon;
grant execute on function public.listar_painel_gerencial_producao_v2() to authenticated,service_role;