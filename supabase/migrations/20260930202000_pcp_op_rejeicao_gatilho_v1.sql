create or replace function public.trg_recompor_op_apos_rejeicao_solicitacao_material_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_op public.producao_ordens_producao%rowtype;
  v_itens_rejeitados jsonb;
  v_itens_recompostos jsonb;
begin
  if new.status is not distinct from old.status
     or new.status <> 'rejeitada'
     or new.ordem_producao_id is null
     or coalesce(new.origem_modulo, '') <> 'producao' then
    return new;
  end if;

  select *
    into v_op
    from public.producao_ordens_producao
   where id = new.ordem_producao_id
   for update;

  if not found then
    return new;
  end if;

  -- Se houver outra solicitação ativa, ela continua sendo o snapshot oficial.
  if exists (
    select 1
      from public.solicitacoes_material sm
     where sm.ordem_producao_id = v_op.id
       and sm.id <> new.id
       and sm.status <> 'rejeitada'
  ) then
    return new;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_id', smi.item_id,
        'nome', smi.nome_item,
        'quantidade', smi.quantidade,
        'unidade', smi.unidade
      )
      order by smi.created_at, smi.id
    ),
    '[]'::jsonb
  )
  into v_itens_rejeitados
  from public.solicitacao_material_itens smi
  where smi.solicitacao_material_id = new.id;

  -- O histórico rejeitado permanece em solicitacoes_material e em seus itens.
  -- Somente o snapshot operacional da OP é recomposto com o PCP vigente.
  delete from public.producao_ordem_materiais om
   where om.ordem_producao_id = v_op.id;

  insert into public.producao_ordem_materiais (
    ordem_producao_id,
    processo_material_id,
    item_id,
    quantidade_planejada,
    unidade_snapshot,
    item_snapshot,
    observacoes
  )
  select
    v_op.id,
    em.id,
    em.item_id,
    em.quantidade_planejada,
    em.unidade_snapshot,
    em.item_snapshot,
    em.observacoes
  from public.producao_etapa_materiais em
  where em.processo_id = v_op.processo_id
  order by em.created_at, em.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_id', om.item_id,
        'nome', coalesce(om.item_snapshot->>'nome', 'Item não identificado'),
        'quantidade', om.quantidade_planejada,
        'unidade', om.unidade_snapshot
      )
      order by om.created_at, om.id
    ),
    '[]'::jsonb
  )
  into v_itens_recompostos
  from public.producao_ordem_materiais om
  where om.ordem_producao_id = v_op.id;

  insert into public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) values (
    v_op.id,
    'pcp_recomposto_apos_rejeicao_solicitacao',
    v_op.status,
    v_op.status,
    coalesce(auth.uid(), new.aprovado_por_id, new.solicitante_id),
    coalesce(new.aprovado_por_nome, new.solicitante_nome, 'Sistema'),
    'Solicitação rejeitada; snapshot da OP recomposto automaticamente com o PCP vigente. Histórico preservado, sem reserva ou baixa de estoque.',
    jsonb_build_object(
      'solicitacao_material_id', new.id,
      'numero', new.numero,
      'itens_solicitacao_rejeitada', v_itens_rejeitados,
      'itens_op_recompostos', v_itens_recompostos,
      'gera_baixa_estoque', false,
      'gera_reserva_estoque', false
    )
  );

  return new;
end;
$function$;

drop trigger if exists trg_recompor_op_apos_rejeicao_solicitacao_material_v1
  on public.solicitacoes_material;

create trigger trg_recompor_op_apos_rejeicao_solicitacao_material_v1
after update of status on public.solicitacoes_material
for each row
when (new.status = 'rejeitada' and old.status is distinct from new.status)
execute function public.trg_recompor_op_apos_rejeicao_solicitacao_material_v1();

revoke execute on function public.trg_recompor_op_apos_rejeicao_solicitacao_material_v1()
  from public, anon, authenticated;

comment on function public.trg_recompor_op_apos_rejeicao_solicitacao_material_v1() is
  'Gatilho interno: ao rejeitar solicitação de origem Produção/PCP, preserva o histórico e recompõe o snapshot operacional da OP com o PCP vigente.';
