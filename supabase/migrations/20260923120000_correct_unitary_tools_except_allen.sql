-- Ferramentas patrimoniais são unitárias por código, exceto chaves Allen.
-- Executado em produção em 2026-09-23. Preserva os valores anteriores em tabela de auditoria.

create table if not exists public.inventory_tool_unit_repair_audit_20260923 (
  movement_id uuid primary key,
  item_id uuid not null,
  codigo_barras bigint,
  nome text,
  tipo text,
  quantidade_anterior_original numeric,
  quantidade_atual_original numeric,
  quantidade_original numeric,
  repaired_at timestamptz not null default now()
);
alter table public.inventory_tool_unit_repair_audit_20260923 enable row level security;
revoke all on public.inventory_tool_unit_repair_audit_20260923 from anon, authenticated;

lock table public.movements in share row exclusive mode;

insert into public.inventory_tool_unit_repair_audit_20260923 (
  movement_id,item_id,codigo_barras,nome,tipo,
  quantidade_anterior_original,quantidade_atual_original,quantidade_original
)
select m.id,m.item_id,i.codigo_barras,i.nome,m.tipo,
       m.quantidade_anterior,m.quantidade_atual,m.quantidade
from public.movements m
join public.items i on i.id=m.item_id
where lower(coalesce(i.tipo_item,''))='ferramenta'
  and coalesce(i.ativo,true)
  and lower(coalesce(i.nome,'')) not like '%allen%'
  and lower(coalesce(i.nome,'')) not like '%alen%'
  and (
    (m.tipo='SAIDA' and (m.quantidade is distinct from 1 or m.quantidade_anterior is distinct from 1 or m.quantidade_atual is distinct from 0))
    or (m.tipo='ENTRADA' and (m.quantidade is distinct from 1 or m.quantidade_anterior is distinct from 0 or m.quantidade_atual is distinct from 1))
    or (m.tipo='CADASTRO' and (m.quantidade_anterior is distinct from 0 or m.quantidade_atual is distinct from 1))
  )
on conflict (movement_id) do nothing;

alter table public.movements disable trigger user;
update public.movements m
set quantidade = case when m.tipo in ('ENTRADA','SAIDA') then 1 else m.quantidade end,
    quantidade_anterior = case when m.tipo='SAIDA' then 1 when m.tipo in ('ENTRADA','CADASTRO') then 0 else m.quantidade_anterior end,
    quantidade_atual = case when m.tipo='SAIDA' then 0 when m.tipo in ('ENTRADA','CADASTRO') then 1 else m.quantidade_atual end
from public.items i
where i.id=m.item_id
  and lower(coalesce(i.tipo_item,''))='ferramenta'
  and coalesce(i.ativo,true)
  and lower(coalesce(i.nome,'')) not like '%allen%'
  and lower(coalesce(i.nome,'')) not like '%alen%'
  and m.tipo in ('ENTRADA','SAIDA','CADASTRO');
alter table public.movements enable trigger user;

create or replace function public.validar_movimento_ferramenta_unitaria_v1()
returns trigger language plpgsql security invoker
set search_path='public','pg_temp'
as $$
declare
  v_item public.items%rowtype;
  v_ultimo_saldo numeric;
begin
  select * into v_item from public.items where id=new.item_id for update;
  if not found
     or lower(coalesce(v_item.tipo_item,'')) <> 'ferramenta'
     or not coalesce(v_item.ativo,true)
     or lower(coalesce(v_item.nome,'')) like '%allen%'
     or lower(coalesce(v_item.nome,'')) like '%alen%' then
    return new;
  end if;

  if new.tipo='CADASTRO' then
    new.quantidade_anterior:=0;
    new.quantidade_atual:=1;
    return new;
  end if;
  if new.tipo not in ('ENTRADA','SAIDA') then return new; end if;

  if new.quantidade is distinct from 1 then
    raise exception 'Ferramenta patrimonial deve ser movimentada individualmente (quantidade 1): %.',v_item.nome;
  end if;

  select m.quantidade_atual into v_ultimo_saldo
  from public.movements m where m.item_id=new.item_id
  order by m.data_hora desc,m.id desc limit 1;

  if new.tipo='SAIDA' then
    if coalesce(v_ultimo_saldo,1)<>1 then
      raise exception 'A ferramenta "%" já está fora do almoxarifado e não pode ter nova saída.',v_item.nome;
    end if;
    new.quantidade_anterior:=1; new.quantidade_atual:=0;
  else
    if coalesce(v_ultimo_saldo,0)<>0 then
      raise exception 'A ferramenta "%" já está no almoxarifado e não pode ter nova devolução/entrada.',v_item.nome;
    end if;
    new.quantidade_anterior:=0; new.quantidade_atual:=1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_movimento_ferramenta_unitaria_v1 on public.movements;
create trigger trg_validar_movimento_ferramenta_unitaria_v1
before insert on public.movements
for each row execute function public.validar_movimento_ferramenta_unitaria_v1();
revoke all on function public.validar_movimento_ferramenta_unitaria_v1() from public;
