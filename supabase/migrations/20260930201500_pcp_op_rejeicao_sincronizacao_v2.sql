create or replace function public.sincronizar_materiais_ordem_producao(
  p_ordem_producao_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_op public.producao_ordens_producao%rowtype;
begin
  if v_user is null
     or not public.usuario_tem_permissao_producao('processos') then
    raise exception 'Sem permissão para sincronizar o PCP da Ordem de Produção';
  end if;

  select *
    into v_op
    from public.producao_ordens_producao
   where id = p_ordem_producao_id
   for update;

  if not found then
    return;
  end if;

  if v_op.status not in ('rascunho', 'liberada', 'em_execucao') then
    return;
  end if;

  -- Uma solicitação ativa congela o snapshot da OP. Solicitações rejeitadas
  -- permanecem no histórico, mas não podem bloquear a próxima sincronização.
  if exists (
    select 1
      from public.solicitacoes_material sm
     where sm.ordem_producao_id = v_op.id
       and sm.status <> 'rejeitada'
  ) then
    return;
  end if;

  -- Sem solicitação ativa, substitui integralmente o snapshot pelo PCP vigente.
  -- Excluir estas linhas não apaga as solicitações rejeitadas nem seus itens.
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
end;
$function$;

create or replace function public.incorporar_materiais_pcp_op(
  p_ordem_producao_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_nome_usuario text;
  v_op public.producao_ordens_producao%rowtype;
  v_total integer := 0;
begin
  if v_user is null
     or not public.usuario_tem_permissao_producao('processos') then
    raise exception 'Sem permissão para incorporar o PCP na Ordem de Produção';
  end if;

  select *
    into v_op
    from public.producao_ordens_producao
   where id = p_ordem_producao_id
   for update;

  if not found then
    raise exception 'Ordem de Produção não encontrada';
  end if;

  if v_op.status not in ('liberada', 'em_execucao') then
    raise exception 'O PCP só pode ser incorporado em uma OP liberada ou em execução';
  end if;

  if exists (
    select 1
      from public.solicitacoes_material sm
     where sm.ordem_producao_id = v_op.id
       and sm.status <> 'rejeitada'
  ) then
    raise exception 'Esta OP já possui uma Solicitação de Material ativa';
  end if;

  if not exists (
    select 1
      from public.producao_etapa_materiais em
     where em.processo_id = v_op.processo_id
  ) then
    raise exception 'A Etapa não possui materiais no PCP. Salve o planejamento antes de incorporar';
  end if;

  perform public.sincronizar_materiais_ordem_producao(v_op.id);

  select count(*)::integer
    into v_total
    from public.producao_ordem_materiais om
   where om.ordem_producao_id = v_op.id;

  if v_total = 0 then
    raise exception 'Nenhum material pôde ser incorporado à OP';
  end if;

  v_nome_usuario := public.nome_usuario_producao(v_user);

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
    'pcp_materiais_incorporado',
    v_op.status,
    v_op.status,
    v_user,
    v_nome_usuario,
    'PCP atual da Etapa incorporado à OP sem proporcionalização. Sem solicitação, reserva ou baixa de estoque.',
    jsonb_build_object(
      'quantidade_itens', v_total,
      'regra_quantidade', 'quantidade_exata_pcp_etapa',
      'substitui_snapshot_sem_solicitacao_ativa', true,
      'preserva_solicitacoes_rejeitadas', true,
      'gera_solicitacao_material', false,
      'gera_baixa_estoque', false,
      'gera_reserva_estoque', false
    )
  );

  return v_total;
end;
$function$;

comment on function public.sincronizar_materiais_ordem_producao(uuid) is
  'Sincroniza o snapshot da OP com o PCP vigente quando não existe solicitação ativa. Solicitações rejeitadas permanecem no histórico e não bloqueiam nova sincronização.';
