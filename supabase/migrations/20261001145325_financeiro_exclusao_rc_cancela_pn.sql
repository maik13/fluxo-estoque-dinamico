-- A exclusão no Almoxarifado encerra a previsão vinculada na mesma transação.
create or replace function public.financeiro_cancelar_pn_rc_excluida()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pn public.financeiro_necessidades%rowtype; v_nome text;
begin
  select coalesce(nome,email,'Usuário') into v_nome from public.profiles where user_id=auth.uid();
  for v_pn in select * from public.financeiro_necessidades
    where requisicao_compra_id=old.id or (id=old.pn_origem_id and origem_tipo='rc')
    for update
  loop
    if exists(select 1 from public.financeiro_lancamentos l where l.necessidade_id=v_pn.id
      and (l.status in ('pago','conciliado') or coalesce(l.valor_realizado,0)<>0 or l.data_realizada is not null))
      or exists(select 1 from public.financeiro_programacoes p join public.financeiro_lancamentos l on l.id=p.lancamento_id
        where l.necessidade_id=v_pn.id and p.status='liquidado') then
      raise exception 'RC #% possui pagamento registrado. Regularize o financeiro antes de excluir a requisição.',old.numero;
    end if;
    update public.financeiro_programacoes p set status='cancelado',updated_at=now()
      from public.financeiro_lancamentos l where p.lancamento_id=l.id and l.necessidade_id=v_pn.id and p.status<>'cancelado';
    update public.financeiro_lancamentos set status='cancelado',updated_at=now()
      where necessidade_id=v_pn.id and status<>'cancelado';
    update public.financeiro_necessidades set status='cancelado',updated_at=now(),updated_by=auth.uid(),
      justificativa=concat_ws(E'\n',justificativa,'RC #'||old.numero||' excluída no Almoxarifado; previsão financeira cancelada automaticamente.')
      where id=v_pn.id;
    insert into public.financeiro_necessidade_historico(necessidade_id,responsavel_id,responsavel_nome,alteracao,valor_previsto)
      values(v_pn.id,auth.uid(),coalesce(v_nome,'Sistema'),
        'RC #'||old.numero||' excluída no Almoxarifado. PN e previsões vinculadas canceladas automaticamente.',v_pn.valor_estimado);
  end loop;
  return old;
end $$;
revoke all on function public.financeiro_cancelar_pn_rc_excluida() from public,anon,authenticated;
create trigger trg_financeiro_exclusao_rc_cancela_pn before delete on public.pedidos_compra
for each row execute function public.financeiro_cancelar_pn_rc_excluida();
