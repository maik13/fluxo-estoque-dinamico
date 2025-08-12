-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- Items table (shared across all users)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  codigo_barras text unique not null,
  origem text,
  caixa_organizador text,
  localizacao text,
  responsavel text,
  nome text not null,
  metragem numeric,
  peso numeric,
  comprimento_lixa numeric,
  polaridade_disjuntor text,
  especificacao text,
  marca text,
  quantidade numeric not null default 0,
  unidade text not null,
  condicao text,
  categoria text,
  subcategoria text,
  sub_destino text,
  tipo_servico text,
  data_criacao timestamptz not null default now(),
  quantidade_minima numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Movements table
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA','SAIDA','CADASTRO')),
  quantidade numeric not null,
  quantidade_anterior numeric not null,
  quantidade_atual numeric not null,
  responsavel text not null,
  observacoes text,
  data_hora timestamptz not null default now(),
  item_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.items enable row level security;
alter table public.movements enable row level security;

-- Policies: all authenticated users can read/write (shared inventory)
create policy if not exists "items_read_all_auth" on public.items for select to authenticated using (true);
create policy if not exists "items_write_all_auth" on public.items for insert to authenticated with check (true);
create policy if not exists "items_update_all_auth" on public.items for update to authenticated using (true) with check (true);
create policy if not exists "items_delete_all_auth" on public.items for delete to authenticated using (true);

create policy if not exists "movements_read_all_auth" on public.movements for select to authenticated using (true);
create policy if not exists "movements_write_all_auth" on public.movements for insert to authenticated with check (true);
create policy if not exists "movements_update_all_auth" on public.movements for update to authenticated using (true) with check (true);
create policy if not exists "movements_delete_all_auth" on public.movements for delete to authenticated using (true);

-- Update updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger trg_items_updated_at
before update on public.items
for each row execute procedure public.update_updated_at();
