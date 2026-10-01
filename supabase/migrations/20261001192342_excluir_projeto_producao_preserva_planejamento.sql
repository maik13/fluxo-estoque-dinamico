-- Exclusão operacional: conserva apenas o vínculo técnico exigido pelo Planejamento.
alter table public.producao_projetos add column if not exists excluido_em timestamptz;
create table public.producao_projetos_exclusoes_auditoria (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null, nome text not null,
  totais jsonb not null, excluido_por_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.producao_projetos_exclusoes_auditoria enable row level security;
revoke all on public.producao_projetos_exclusoes_auditoria from public,anon,authenticated;
grant select on public.producao_projetos_exclusoes_auditoria to authenticated;
create policy projetos_exclusoes_admin_leitura on public.producao_projetos_exclusoes_auditoria
  for select to authenticated using ((select public.is_admin()));

create or replace function public.resumo_exclusao_projeto_producao_v1(p_projeto_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.producao_projetos%rowtype; etapas uuid[]; ops uuid[];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente administradores podem excluir projetos da Produção' using errcode='42501'; end if;
  select * into p from public.producao_projetos where id=p_projeto_id and excluido_em is null;
  if not found then raise exception 'Projeto não encontrado ou já excluído'; end if;
  select coalesce(array_agg(id),'{}') into etapas from public.producao_processos where projeto_id=p.id;
  select coalesce(array_agg(id),'{}') into ops from public.producao_ordens_producao where projeto_id=p.id or processo_id=any(etapas);
  return jsonb_build_object('projeto_id',p.id,'nome',p.nome,'etapas',cardinality(etapas),'ops',cardinality(ops),
    'apontamentos',(select count(*) from public.producao_apontamentos where processo_id=any(etapas) or ordem_producao_id=any(ops) or (processo_id is null and ordem_producao_id is null and projeto_local_id=p.local_utilizacao_id)),
    'jornadas',(select count(*) from public.producao_op_jornadas where ordem_producao_id=any(ops)));
end $$;

create or replace function public.excluir_projeto_producao_v1(p_projeto_id uuid,p_nome_confirmacao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.producao_projetos%rowtype; etapas uuid[]; ops uuid[]; apontamentos uuid[]; resumo jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente administradores podem excluir projetos da Produção' using errcode='42501'; end if;
  select * into p from public.producao_projetos where id=p_projeto_id for update;
  if not found or p.excluido_em is not null then raise exception 'Projeto não encontrado ou já excluído'; end if;
  if btrim(coalesce(p_nome_confirmacao,''))<>btrim(p.nome) then raise exception 'O nome de confirmação não corresponde ao projeto'; end if;
  perform 1 from public.producao_processos where projeto_id=p.id order by id for update;
  select coalesce(array_agg(id),'{}') into etapas from public.producao_processos where projeto_id=p.id;
  perform 1 from public.producao_ordens_producao where projeto_id=p.id or processo_id=any(etapas) order by id for update;
  select coalesce(array_agg(id),'{}') into ops from public.producao_ordens_producao where projeto_id=p.id or processo_id=any(etapas);
  select coalesce(array_agg(id),'{}') into apontamentos from public.producao_apontamentos
    where processo_id=any(etapas) or ordem_producao_id=any(ops)
      or (processo_id is null and ordem_producao_id is null and projeto_local_id=p.local_utilizacao_id);
  resumo:=public.resumo_exclusao_projeto_producao_v1(p.id);
  -- As tabelas de planejamento, estoque e financeiro não são excluídas.
  delete from public.producao_op_jornadas where ordem_producao_id=any(ops);
  delete from public.producao_led_registros where ordem_producao_id=any(ops) or apontamento_id=any(apontamentos);
  delete from public.producao_consumos_tinta where ordem_producao_id=any(ops) or apontamento_id=any(apontamentos);
  delete from public.producao_materiais_projeto where projeto_local_id=p.local_utilizacao_id or apontamento_id=any(apontamentos);
  delete from public.producao_apontamentos where id=any(apontamentos);
  delete from public.producao_ordens_etapas_auditoria where projeto_id=p.id or ordem_producao_id=any(ops);
  delete from public.producao_ordens_producao where id=any(ops);
  delete from public.producao_processos where id=any(etapas);
  delete from public.producao_cronograma_marcos where projeto_id=p.id;
  delete from public.producao_programacao_diaria where projeto_id=p.id;
  delete from public.producao_projeto_grupos where projeto_id=p.id;
  -- Mantém o id exigido pelo Planejamento, mas o projeto deixa de existir nas listas operacionais.
  update public.producao_projetos set ativo=false,excluido_em=now(),updated_at=now() where id=p.id;
  insert into public.producao_projetos_exclusoes_auditoria(projeto_id,nome,totais,excluido_por_id)
    values(p.id,p.nome,resumo,auth.uid());
  return resumo;
end $$;
revoke all on function public.resumo_exclusao_projeto_producao_v1(uuid) from public,anon;
revoke all on function public.excluir_projeto_producao_v1(uuid,text) from public,anon;
grant execute on function public.resumo_exclusao_projeto_producao_v1(uuid) to authenticated;
grant execute on function public.excluir_projeto_producao_v1(uuid,text) to authenticated;

create or replace function public.impedir_reativacao_projeto_excluido_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.excluido_em is not null and (new.ativo or new.excluido_em is null) then
    raise exception 'Este projeto foi excluído da Produção e não pode ser reativado automaticamente';
  end if;
  return new;
end $$;
revoke all on function public.impedir_reativacao_projeto_excluido_v1() from public,anon,authenticated;
create trigger trg_impedir_reativacao_projeto_excluido before update on public.producao_projetos
for each row execute function public.impedir_reativacao_projeto_excluido_v1();

create or replace function public.impedir_etapa_projeto_excluido_v1()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.producao_projetos where id=new.projeto_id and excluido_em is not null) then
    raise exception 'Não é possível criar etapas ou OPs em um projeto excluído';
  end if;
  return new;
end $$;
revoke all on function public.impedir_etapa_projeto_excluido_v1() from public,anon,authenticated;
create trigger trg_impedir_etapa_projeto_excluido before insert or update of projeto_id on public.producao_processos
for each row execute function public.impedir_etapa_projeto_excluido_v1();
create trigger trg_impedir_op_projeto_excluido before insert or update of projeto_id on public.producao_ordens_producao
for each row execute function public.impedir_etapa_projeto_excluido_v1();
