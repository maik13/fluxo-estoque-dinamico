create or replace function public.calcular_saldo_movimento_atomico_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_saldo numeric := 0;
  v_operacao text := '';
begin
  if new.tipo not in ('ENTRADA', 'SAIDA') then
    return new;
  end if;

  if new.quantidade is null or new.quantidade <= 0 then
    raise exception 'A quantidade da movimentação deve ser maior que zero.';
  end if;

  perform 1
  from public.items
  where id = new.item_id
  for update;

  if not found then
    raise exception 'Item não encontrado para registrar a movimentação.';
  end if;

  select coalesce(m.quantidade_atual, 0)
    into v_saldo
  from public.movements m
  where m.item_id = new.item_id
    and m.estoque_id is not distinct from new.estoque_id
  order by m.data_hora desc, m.id desc
  limit 1;

  v_saldo := coalesce(v_saldo, 0);

  if new.tipo_operacao_id is not null then
    select lower(trim(coalesce(t.nome, '')))
      into v_operacao
    from public.tipos_operacao t
    where t.id = new.tipo_operacao_id;
  end if;

  new.quantidade_anterior := v_saldo;

  if new.tipo = 'ENTRADA' then
    if coalesce(v_operacao, '') like '%acerto%' then
      new.quantidade_atual := new.quantidade;
    else
      new.quantidade_atual := v_saldo + new.quantidade;
    end if;
  else
    if new.quantidade > v_saldo then
      raise exception
        'Estoque insuficiente. Saldo atual: %, quantidade solicitada: %.',
        v_saldo, new.quantidade;
    end if;
    new.quantidade_atual := v_saldo - new.quantidade;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_00_calcular_saldo_movimento_atomico_v1
on public.movements;

create trigger trg_00_calcular_saldo_movimento_atomico_v1
before insert on public.movements
for each row
execute function public.calcular_saldo_movimento_atomico_v1();

comment on function public.calcular_saldo_movimento_atomico_v1() is
'Calcula saldos dentro da transação e serializa movimentações por item para impedir concorrência e saldos desatualizados.';
