-- Garante uma única fonte de verdade para todos os itens:
-- categoria Ferramenta => tipo_item Ferramenta; demais categorias => Insumo.
create or replace function public.normalizar_tipo_item_por_categoria_v1()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_categoria_nome text;
begin
  select lower(trim(coalesce(c.nome, '')))
    into v_categoria_nome
  from public.categorias c
  where c.id = new.categoria_id;

  new.tipo_item := case
    when coalesce(v_categoria_nome, '') = 'ferramenta' then 'Ferramenta'
    else 'Insumo'
  end;

  return new;
end;
$function$;

drop trigger if exists trg_normalizar_tipo_item_por_categoria_v1 on public.items;
create trigger trg_normalizar_tipo_item_por_categoria_v1
before insert or update of categoria_id, tipo_item
on public.items
for each row
execute function public.normalizar_tipo_item_por_categoria_v1();

update public.items i
set tipo_item = case
  when lower(trim(coalesce(c.nome, ''))) = 'ferramenta' then 'Ferramenta'
  else 'Insumo'
end,
updated_at = now()
from public.categorias c
where c.id = i.categoria_id
  and i.tipo_item is distinct from case
    when lower(trim(coalesce(c.nome, ''))) = 'ferramenta' then 'Ferramenta'
    else 'Insumo'
  end;

update public.items
set tipo_item = 'Insumo',
    updated_at = now()
where categoria_id is null
  and tipo_item is distinct from 'Insumo';
