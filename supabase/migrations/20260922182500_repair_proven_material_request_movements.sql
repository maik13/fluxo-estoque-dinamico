-- Reparo conservador executado em produção em 2026-09-22.
-- Corrige somente movimentos com saldo 0 -> 0 gerados pela conversão antiga
-- de Solicitação de Material, quando a sequência possui âncoras cronológicas
-- suficientes e o saldo reconstruído não é negativo.
-- A migração aborta se o conjunto comprovado não contiver exatamente 120 linhas.

create table public.inventory_movement_repair_audit_20260922 (
  movement_id uuid primary key references public.movements(id),
  item_id uuid not null references public.items(id),
  estoque_id uuid,
  old_quantidade_anterior numeric,
  old_quantidade_atual numeric,
  new_quantidade_anterior numeric not null,
  new_quantidade_atual numeric not null,
  repair_method text not null,
  reason text not null,
  repaired_at timestamptz not null default now()
);

alter table public.inventory_movement_repair_audit_20260922 enable row level security;
revoke all on public.inventory_movement_repair_audit_20260922 from anon, authenticated;

create temporary table _inventory_repair_20260922 on commit drop as
with base as (
  select m.*,
    (m.observacoes like 'Retirada - Solicitação Material #%'
      and coalesce(m.quantidade_anterior, 0) = 0
      and coalesce(m.quantidade_atual, 0) = 0) as bug
  from public.movements m
),
sequenced as (
  select b.*,
    row_number() over (
      partition by item_id, estoque_id order by data_hora, created_at, id
    ) as rn,
    count(*) filter (where not bug) over (
      partition by item_id, estoque_id order by data_hora, created_at, id
      rows between unbounded preceding and current row
    ) as grp
  from base b
),
chains as (
  select item_id, estoque_id, grp, min(rn) first_rn, max(rn) last_rn,
    sum(quantidade) total_saida
  from sequenced where bug
  group by item_id, estoque_id, grp
),
anchored as (
  select c.*, p.quantidade_atual saldo_antes,
    n.quantidade_anterior saldo_depois, p.id prev_id, n.id next_id
  from chains c
  left join sequenced p
    on p.item_id = c.item_id
   and p.estoque_id is not distinct from c.estoque_id
   and p.rn = c.first_rn - 1 and not p.bug
  left join sequenced n
    on n.item_id = c.item_id
   and n.estoque_id is not distinct from c.estoque_id
   and n.rn = c.last_rn + 1 and not n.bug
),
eligible as (
  select a.*,
    case when prev_id is null then saldo_depois + total_saida else saldo_antes end start_balance,
    case when prev_id is null then 'reverse_anchor' else 'both_anchors' end repair_method
  from anchored a
  where (prev_id is not null and next_id is not null
         and saldo_antes - total_saida = saldo_depois)
     or (prev_id is null and next_id is not null)
),
calculated as (
  select s.id movement_id, s.item_id, s.estoque_id,
    s.quantidade_anterior old_quantidade_anterior,
    s.quantidade_atual old_quantidade_atual,
    e.start_balance - coalesce(sum(s.quantidade) over (
      partition by s.item_id, s.estoque_id, s.grp order by s.rn
      rows between unbounded preceding and 1 preceding
    ), 0) new_quantidade_anterior,
    e.start_balance - sum(s.quantidade) over (
      partition by s.item_id, s.estoque_id, s.grp order by s.rn
      rows between unbounded preceding and current row
    ) new_quantidade_atual,
    e.repair_method
  from sequenced s
  join eligible e using (item_id, estoque_id, grp)
  where s.bug
)
select * from calculated
where new_quantidade_anterior >= 0 and new_quantidade_atual >= 0;

do $$
declare v_count integer;
begin
  select count(*) into v_count from _inventory_repair_20260922;
  if v_count <> 120 then
    raise exception 'Repair aborted: expected 120 proven rows, found %', v_count;
  end if;
end $$;

insert into public.inventory_movement_repair_audit_20260922
(movement_id, item_id, estoque_id, old_quantidade_anterior, old_quantidade_atual,
 new_quantidade_anterior, new_quantidade_atual, repair_method, reason)
select movement_id, item_id, estoque_id, old_quantidade_anterior, old_quantidade_atual,
 new_quantidade_anterior, new_quantidade_atual, repair_method,
 'Correção do bug histórico da conversão de Solicitação de Material em Retirada; saldo reconstruído por âncoras cronológicas comprovadas.'
from _inventory_repair_20260922;

lock table public.movements in share row exclusive mode;
alter table public.movements disable trigger trg_validar_permissao_mutacao_movements_v1;

update public.movements m
set quantidade_anterior = r.new_quantidade_anterior,
    quantidade_atual = r.new_quantidade_atual
from _inventory_repair_20260922 r
where m.id = r.movement_id
  and coalesce(m.quantidade_anterior, 0) = 0
  and coalesce(m.quantidade_atual, 0) = 0;

alter table public.movements enable trigger trg_validar_permissao_mutacao_movements_v1;

do $$
declare v_correct integer; v_item_682 integer;
begin
  select count(*) into v_correct
  from public.movements m
  join public.inventory_movement_repair_audit_20260922 a on a.movement_id = m.id
  where m.quantidade_anterior = a.new_quantidade_anterior
    and m.quantidade_atual = a.new_quantidade_atual;
  if v_correct <> 120 then
    raise exception 'Repair verification failed: expected 120 corrected rows, found %', v_correct;
  end if;

  select count(*) into v_item_682
  from public.movements m join public.items i on i.id = m.item_id
  where i.codigo_barras = 682
    and m.observacoes like 'Retirada - Solicitação Material #%'
    and m.quantidade_anterior = 3 and m.quantidade_atual = 2;
  if v_item_682 <> 1 then
    raise exception 'Repair verification failed for item 682';
  end if;
end $$;
