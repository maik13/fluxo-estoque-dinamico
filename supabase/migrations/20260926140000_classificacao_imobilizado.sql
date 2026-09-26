alter table public.items
add column if not exists imobilizado boolean not null default false;

comment on column public.items.imobilizado is
  'Classificação patrimonial calculada: ferramenta ou produto/locação com valor unitário superior a R$ 1.500.';

create or replace function public.classificar_item_imobilizado_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_categoria text;
  v_subcategoria text;
begin
  select lower(trim(c.nome))
    into v_categoria
    from public.categorias c
   where c.id = new.categoria_id;

  select lower(trim(s.nome))
    into v_subcategoria
    from public.subcategorias s
   where s.id = new.subcategoria_id;

  new.imobilizado :=
    coalesce(new.valor, 0) > 1500
    and (
      v_categoria = 'ferramenta'
      or (
        v_categoria = 'produto'
        and v_subcategoria in ('locação', 'locacao')
      )
    );

  return new;
end;
$$;

drop trigger if exists trg_classificar_item_imobilizado_v1 on public.items;
create trigger trg_classificar_item_imobilizado_v1
before insert or update of categoria_id, subcategoria_id, valor
on public.items
for each row execute function public.classificar_item_imobilizado_v1();

update public.items i
set imobilizado =
  coalesce(i.valor, 0) > 1500
  and (
    coalesce((select lower(trim(c.nome)) from public.categorias c where c.id = i.categoria_id), '') = 'ferramenta'
    or (
      coalesce((select lower(trim(c.nome)) from public.categorias c where c.id = i.categoria_id), '') = 'produto'
      and coalesce((select lower(trim(s.nome)) from public.subcategorias s where s.id = i.subcategoria_id), '') in ('locação', 'locacao')
    )
  );

create index if not exists idx_items_imobilizado
on public.items (imobilizado)
where ativo = true;
