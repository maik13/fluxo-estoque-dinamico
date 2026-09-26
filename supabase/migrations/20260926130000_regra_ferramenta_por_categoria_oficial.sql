-- A regra patrimonial deve seguir a categoria oficial "Ferramenta".
-- O campo legado tipo_item continha consumíveis importados como ferramenta,
-- bloqueando entradas legítimas com quantidade maior que 1.
create or replace function public.validar_movimento_ferramenta_unitaria_v1()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_item public.items%rowtype;
  v_ultimo_saldo numeric;
  v_eh_ferramenta boolean;
begin
  select * into v_item
  from public.items
  where id = new.item_id
  for update;

  if not found then
    return new;
  end if;

  select exists (
    select 1
    from public.categorias c
    where c.id = v_item.categoria_id
      and lower(trim(coalesce(c.nome, ''))) = 'ferramenta'
  ) into v_eh_ferramenta;

  if not v_eh_ferramenta
     or not coalesce(v_item.ativo, true)
     or lower(coalesce(v_item.nome, '')) like '%allen%'
     or lower(coalesce(v_item.nome, '')) like '%alen%' then
    return new;
  end if;

  if new.tipo = 'CADASTRO' then
    new.quantidade_anterior := 0;
    new.quantidade_atual := 1;
    return new;
  end if;

  if new.tipo not in ('ENTRADA', 'SAIDA') then
    return new;
  end if;

  if new.quantidade is distinct from 1 then
    raise exception 'Ferramenta patrimonial deve ser movimentada individualmente (quantidade 1): %.', v_item.nome;
  end if;

  select m.quantidade_atual into v_ultimo_saldo
  from public.movements m
  where m.item_id = new.item_id
  order by m.data_hora desc, m.id desc
  limit 1;

  if new.tipo = 'SAIDA' then
    if coalesce(v_ultimo_saldo, 1) <> 1 then
      raise exception 'A ferramenta "%" já está fora do almoxarifado e não pode ter nova saída.', v_item.nome;
    end if;
    new.quantidade_anterior := 1;
    new.quantidade_atual := 0;
  else
    if coalesce(v_ultimo_saldo, 0) <> 0 then
      raise exception 'A ferramenta "%" já está no almoxarifado e não pode ter nova devolução/entrada.', v_item.nome;
    end if;
    new.quantidade_anterior := 0;
    new.quantidade_atual := 1;
  end if;

  return new;
end;
$function$;

update public.items i
set tipo_item = 'Insumo',
    updated_at = now()
from public.categorias c
where c.id = i.categoria_id
  and lower(coalesce(i.tipo_item, '')) = 'ferramenta'
  and lower(trim(coalesce(c.nome, ''))) <> 'ferramenta';
