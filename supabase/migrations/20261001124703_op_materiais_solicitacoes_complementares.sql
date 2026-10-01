drop index public.solicitacoes_material_op_ativa_unique;
create index solicitacoes_material_op_historico_idx on public.solicitacoes_material(ordem_producao_id,created_at desc) where ordem_producao_id is not null;
CREATE OR REPLACE FUNCTION public.sincronizar_materiais_ordem_producao(p_ordem_producao_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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


  -- Histórico solicitado é imutável; apenas o saldo ainda não solicitado é atualizado.
  delete from public.producao_ordem_materiais om
  where om.ordem_producao_id=v_op.id and not exists (
    select 1 from public.solicitacao_material_itens si
    join public.solicitacoes_material sm on sm.id=si.solicitacao_material_id
    where sm.ordem_producao_id=v_op.id and sm.status <> 'rejeitada' and si.item_id=om.item_id
  );
  insert into public.producao_ordem_materiais (
    ordem_producao_id,processo_material_id,item_id,quantidade_planejada,
    unidade_snapshot,item_snapshot,observacoes)
  select v_op.id,em.id,em.item_id,em.quantidade_planejada,
    em.unidade_snapshot,em.item_snapshot,em.observacoes
  from public.producao_etapa_materiais em where em.processo_id=v_op.processo_id
  on conflict (ordem_producao_id,item_id) do update
    set quantidade_planejada=greatest(excluded.quantidade_planejada,producao_ordem_materiais.quantidade_solicitada),
        processo_material_id=excluded.processo_material_id,
        updated_at=now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.incorporar_materiais_pcp_op(p_ordem_producao_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   where om.ordem_producao_id = v_op.id and om.quantidade_planejada > om.quantidade_solicitada;

  if v_total = 0 then
    raise exception 'Não há materiais adicionais: os itens e quantidades atuais do PCP já foram solicitados';
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
$function$
;
CREATE OR REPLACE FUNCTION public.gerar_solicitacao_material_op(p_ordem_producao_id uuid, p_estoque_id uuid)
 RETURNS TABLE(solicitacao_id uuid, numero bigint, status text, created_at timestamp with time zone, data_limite_separacao timestamp with time zone, ja_existia boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_etapa public.producao_processos%ROWTYPE;
  v_projeto public.producao_projetos%ROWTYPE;
  v_local_nome TEXT;
  v_solicitacao_id UUID;
  v_numero BIGINT;
  v_created_at TIMESTAMPTZ;
  v_limite TIMESTAMPTZ;
  v_material RECORD;
  v_item_solicitacao_id UUID;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para gerar Solicitação de Material pela OP';
  END IF;

  IF p_estoque_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.estoques e WHERE e.id = p_estoque_id) THEN
    RAISE EXCEPTION 'Selecione um estoque válido antes de gerar a solicitação';
  END IF;

  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'A solicitação só pode ser gerada para uma OP liberada ou em execução';
  END IF;


  PERFORM public.sincronizar_materiais_ordem_producao(v_op.id);
  IF NOT EXISTS (SELECT 1 FROM public.producao_ordem_materiais om
    WHERE om.ordem_producao_id=v_op.id AND om.quantidade_planejada>om.quantidade_solicitada) THEN
    SELECT sm.id,sm.numero,sm.created_at,sm.data_limite_separacao
    INTO v_solicitacao_id,v_numero,v_created_at,v_limite
    FROM public.solicitacoes_material sm WHERE sm.ordem_producao_id=v_op.id
      AND sm.status <> 'rejeitada' ORDER BY sm.created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_solicitacao_id,v_numero,
        (SELECT sm.status FROM public.solicitacoes_material sm WHERE sm.id=v_solicitacao_id),
        v_created_at,v_limite,TRUE;
      RETURN;
    END IF;
    RAISE EXCEPTION 'A OP não possui materiais adicionais. Salve o PCP na Etapa antes de solicitar';
  END IF;
  SELECT * INTO v_etapa
    FROM public.producao_processos
   WHERE id = v_op.processo_id;

  SELECT * INTO v_projeto
    FROM public.producao_projetos
   WHERE id = v_op.projeto_id;

  SELECT l.nome
    INTO v_local_nome
    FROM public.locais_utilizacao l
   WHERE l.id = v_projeto.local_utilizacao_id;

  v_nome_usuario := public.nome_usuario_producao(v_user);
  v_limite := NOW() + INTERVAL '1 day';

  INSERT INTO public.solicitacoes_material (
    solicitante_id,
    solicitante_nome,
    observacoes,
    status,
    estoque_id,
    local_origem,
    local_origem_id,
    origem_modulo,
    producao_projeto_id,
    processo_id,
    ordem_producao_id,
    data_necessidade,
    data_limite_separacao
  ) VALUES (
    v_user,
    v_nome_usuario,
    CONCAT(
      'ORIGEM: PRODUÇÃO / PCP. Projeto: ', COALESCE(v_projeto.nome, 'não identificado'),
      ' | Etapa: ', COALESCE(v_etapa.codigo, ''), ' - ', COALESCE(v_etapa.nome, ''),
      ' | OP: OP ', LPAD(v_op.numero::TEXT, 6, '0'),
      ' | Prazo máximo de separação: 1 dia após a solicitação. ',
      'Esta solicitação não realizou baixa nem reserva automática no estoque.'
    ),
    'pendente',
    p_estoque_id,
    COALESCE(v_local_nome, v_projeto.nome, 'Produção'),
    v_projeto.local_utilizacao_id,
    'producao',
    v_projeto.id,
    v_etapa.id,
    v_op.id,
    v_op.data_inicio_prevista,
    v_limite
  )
  RETURNING id, solicitacoes_material.numero, solicitacoes_material.created_at
    INTO v_solicitacao_id, v_numero, v_created_at;

  FOR v_material IN
    SELECT *
      FROM public.producao_ordem_materiais
     WHERE ordem_producao_id = v_op.id AND quantidade_planejada > quantidade_solicitada
     ORDER BY created_at, id
  LOOP
    INSERT INTO public.solicitacao_material_itens (
      solicitacao_material_id,
      item_id,
      nome_item,
      quantidade,
      unidade,
      item_snapshot,
      observacoes
    ) VALUES (
      v_solicitacao_id,
      v_material.item_id,
      COALESCE(v_material.item_snapshot->>'nome', 'Item não identificado'),
      v_material.quantidade_planejada - v_material.quantidade_solicitada,
      v_material.unidade_snapshot,
      v_material.item_snapshot,
      v_material.observacoes
    )
    RETURNING id INTO v_item_solicitacao_id;

    UPDATE public.producao_ordem_materiais
       SET quantidade_solicitada = v_material.quantidade_planejada,
           solicitacao_material_id = v_solicitacao_id,
           solicitacao_material_item_id = v_item_solicitacao_id,
           updated_at = NOW()
     WHERE id = v_material.id;
  END LOOP;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_op.id,
    'solicitacao_material_gerada',
    v_op.status,
    v_op.status,
    v_user,
    v_nome_usuario,
    'Solicitação oficial enviada ao Almoxarifado. Prazo máximo informado: 1 dia.',
    JSONB_BUILD_OBJECT(
      'solicitacao_material_id', v_solicitacao_id,
      'numero', v_numero,
      'data_limite_separacao', v_limite,
      'gera_baixa_estoque', FALSE,
      'gera_reserva_estoque', FALSE
    )
  );

  RETURN QUERY SELECT
    v_solicitacao_id,
    v_numero,
    'pendente'::TEXT,
    v_created_at,
    v_limite,
    FALSE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.trg_recompor_op_apos_rejeicao_solicitacao_material_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
begin
 if new.status is distinct from old.status and new.status='rejeitada' and new.ordem_producao_id is not null and new.origem_modulo='producao' then
   perform 1 from public.producao_ordens_producao where id=new.ordem_producao_id for update;
   update public.producao_ordem_materiais om set
     quantidade_solicitada=coalesce((select sum(si.quantidade)
       from public.solicitacao_material_itens si join public.solicitacoes_material sm on sm.id=si.solicitacao_material_id
       where sm.ordem_producao_id=new.ordem_producao_id and sm.status <> 'rejeitada' and si.item_id=om.item_id),0),
     solicitacao_material_id=case when om.solicitacao_material_id=new.id then null else om.solicitacao_material_id end,
     solicitacao_material_item_id=case when om.solicitacao_material_id=new.id then null else om.solicitacao_material_item_id end,
     updated_at=now()
   where om.ordem_producao_id=new.ordem_producao_id and exists (
     select 1 from public.solicitacao_material_itens si where si.solicitacao_material_id=new.id and si.item_id=om.item_id
   );
 end if;
 return new;
end $$;