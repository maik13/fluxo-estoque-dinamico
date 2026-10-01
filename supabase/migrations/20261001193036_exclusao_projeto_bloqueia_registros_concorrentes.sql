create or replace function public.impedir_etapa_projeto_excluido_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_excluido timestamptz;
begin
  select excluido_em into v_excluido from public.producao_projetos where id=new.projeto_id for key share;
  if v_excluido is not null then raise exception 'Não é possível criar etapas ou OPs em um projeto excluído'; end if;
  return new;
end $$;
create or replace function public.impedir_apontamento_projeto_excluido_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_excluido timestamptz;
begin
  select excluido_em into v_excluido from public.producao_projetos where local_utilizacao_id=new.projeto_local_id for key share;
  if v_excluido is not null then raise exception 'Não é possível registrar produção em um projeto excluído'; end if;
  return new;
end $$;
revoke all on function public.impedir_apontamento_projeto_excluido_v1() from public,anon,authenticated;
create trigger trg_impedir_apontamento_projeto_excluido before insert or update of projeto_local_id on public.producao_apontamentos
for each row execute function public.impedir_apontamento_projeto_excluido_v1();
