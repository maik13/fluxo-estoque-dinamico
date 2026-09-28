BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_split_tec24_cards_20260928;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.projeto
AS SELECT * FROM public.producao_projetos
WHERE id='1289e951-2c65-457e-910d-5f9a80b53182'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.local
AS SELECT * FROM public.locais_utilizacao
WHERE id='5e5c3a3a-f323-464c-bd02-19584f89b4c7'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.processos
AS SELECT * FROM public.producao_processos
WHERE projeto_id='1289e951-2c65-457e-910d-5f9a80b53182'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.ops
AS SELECT * FROM public.producao_ordens_producao
WHERE projeto_id='1289e951-2c65-457e-910d-5f9a80b53182'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.apontamentos
AS SELECT a.* FROM public.producao_apontamentos a
JOIN backup_split_tec24_cards_20260928.ops o ON o.id=a.ordem_producao_id;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.grupos
AS SELECT * FROM public.producao_projeto_grupos
WHERE projeto_id='1289e951-2c65-457e-910d-5f9a80b53182'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.planejamento
AS SELECT * FROM public.producao_planejamento_projeto_pecas
WHERE producao_projeto_id='1289e951-2c65-457e-910d-5f9a80b53182'::uuid
   OR local_utilizacao_id='5e5c3a3a-f323-464c-bd02-19584f89b4c7'::uuid;

CREATE TABLE IF NOT EXISTS backup_split_tec24_cards_20260928.metadados(
  id integer PRIMARY KEY DEFAULT 1 CHECK(id=1),
  criado_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL
);
INSERT INTO backup_split_tec24_cards_20260928.metadados(id,motivo)
VALUES(
  1,
  'Correção do TEC-24 para um card operacional por cidade, mantendo a referência mestre da peça. OP29 = Brusque; demais OPs = Rolândia.'
)
ON CONFLICT(id) DO NOTHING;

-- Mantém a trava normal, mas permite reparent administrativo somente em sessão
-- direta postgres e com flag explícita local à transação.
CREATE OR REPLACE FUNCTION public.bloquear_reparent_op_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_projeto_etapa uuid;
  v_reclassificacao_etapa boolean :=
    COALESCE(current_setting('app.reclassificar_op_etapa', true), '') = 'on';
  v_reparent_admin boolean :=
    session_user = 'postgres'
    AND COALESCE(current_setting('app.reparent_op_admin', true), '') = 'on';
BEGIN
  SELECT p.projeto_id
  INTO v_projeto_etapa
  FROM public.producao_processos p
  WHERE p.id=NEW.processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa da Ordem de Produção não existe';
  END IF;

  IF NEW.projeto_id IS DISTINCT FROM v_projeto_etapa THEN
    RAISE EXCEPTION 'O Projeto da OP deve ser o mesmo Projeto da Etapa';
  END IF;

  IF TG_OP='UPDATE' THEN
    IF OLD.projeto_id IS DISTINCT FROM NEW.projeto_id
       AND NOT v_reparent_admin THEN
      RAISE EXCEPTION 'O Projeto da Ordem de Produção não pode ser alterado após a emissão';
    END IF;

    IF OLD.processo_id IS DISTINCT FROM NEW.processo_id
       AND NOT (v_reclassificacao_etapa OR v_reparent_admin) THEN
      RAISE EXCEPTION 'A Etapa da Ordem de Produção só pode ser alterada pela rotina controlada de reclassificação';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  v_rol_project uuid := '1289e951-2c65-457e-910d-5f9a80b53182'::uuid;
  v_rol_local uuid := '5e5c3a3a-f323-464c-bd02-19584f89b4c7'::uuid;
  v_br_group uuid := 'c031b608-1cab-49ca-8f6f-992491d7eca7'::uuid;
  v_rol_group uuid := 'ff8336f8-5fcb-40c9-8bd4-85a21666ff93'::uuid;
  v_op29 uuid := '5cf62883-cf42-4bce-9baa-510f9d170063'::uuid;
  v_old_stage2 uuid := '4b7a987e-32fd-433f-b2a3-89e6d5e7768c'::uuid;
  v_br_local uuid;
  v_br_project uuid;
  v_br_stage2 uuid;
  v_br_stage2_code text;
  v_source public.producao_projetos%ROWTYPE;
BEGIN
  SELECT * INTO v_source
  FROM public.producao_projetos
  WHERE id=v_rol_project
  FOR UPDATE;

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Projeto TEC-24 atual não encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.producao_projetos p
    JOIN public.locais_utilizacao l ON l.id=p.local_utilizacao_id
    WHERE l.group_id=v_br_group
      AND lower(p.nome) LIKE '%bolas penduradas%80%'
  ) THEN
    RAISE EXCEPTION 'Já existe um card operacional TEC-24 de Brusque; abortando para evitar duplicação';
  END IF;

  -- O cadastro operacional existente passa a representar Rolândia.
  UPDATE public.locais_utilizacao
  SET nome='TEC-24 - Bolas penduradas - 80 cm - Rolândia',
      group_id=v_rol_group,
      updated_at=now()
  WHERE id=v_rol_local;

  UPDATE public.producao_projetos
  SET nome='TEC-24 - Bolas penduradas - 80 cm - Rolândia',
      cidade='Rolândia',
      uf='PR',
      local_execucao='Rolândia',
      endereco_execucao=NULL,
      observacoes=concat_ws(
        E'\n',
        NULLIF(regexp_replace(COALESCE(observacoes,''),'Cadastro mestre compartilhado entre Brusque e Rolândia\. Destino operacional definido por OP\.?','','gi'),''),
        'Instância operacional do TEC-24 destinada a Rolândia. A referência mestre da peça continua única no Planejamento.'
      ),
      atualizado_por_nome_snapshot='Correção TEC-24: card por cidade',
      updated_at=now()
  WHERE id=v_rol_project;

  DELETE FROM public.producao_projeto_grupos
  WHERE projeto_id=v_rol_project
    AND project_group_id<>v_rol_group;

  INSERT INTO public.producao_projeto_grupos(
    projeto_id,project_group_id,quantidade_planejada,origem,ativo
  ) VALUES (
    v_rol_project,v_rol_group,50,'planejamento',true
  )
  ON CONFLICT(projeto_id,project_group_id)
  DO UPDATE SET
    quantidade_planejada=50,
    origem='planejamento',
    ativo=true,
    updated_at=now();

  -- Novo card operacional para Brusque; não é um novo cadastro mestre da peça.
  INSERT INTO public.locais_utilizacao(
    id,nome,ativo,created_at,updated_at,group_id
  ) VALUES (
    gen_random_uuid(),
    'TEC-24 - Bolas penduradas - 80 cm - Brusque',
    true,now(),now(),v_br_group
  )
  RETURNING id INTO v_br_local;

  INSERT INTO public.producao_projetos(
    local_utilizacao_id,nome,cidade,uf,local_execucao,endereco_execucao,
    cliente,descricao,observacoes,ativo,status,
    responsavel_id,responsavel_nome_snapshot,
    criado_por_id,criado_por_nome_snapshot,
    atualizado_por_id,atualizado_por_nome_snapshot,
    data_inicio_real
  ) VALUES (
    v_br_local,
    'TEC-24 - Bolas penduradas - 80 cm - Brusque',
    'Brusque','SC','Brusque',NULL,
    v_source.cliente,v_source.descricao,
    'Instância operacional do TEC-24 destinada a Brusque. A referência mestre da peça continua única no Planejamento.',
    true,'em_andamento',
    v_source.responsavel_id,v_source.responsavel_nome_snapshot,
    v_source.criado_por_id,'Correção TEC-24: card por cidade',
    v_source.atualizado_por_id,'Correção TEC-24: card por cidade',
    '2026-08-25'::date
  )
  RETURNING id INTO v_br_project;

  PERFORM app_private.garantir_etapas_padrao_projeto_v1(v_br_project);

  SELECT id,codigo
  INTO v_br_stage2,v_br_stage2_code
  FROM public.producao_processos
  WHERE projeto_id=v_br_project
    AND nome='Etapa 2'
  ORDER BY created_at
  LIMIT 1;

  IF v_br_stage2 IS NULL THEN
    RAISE EXCEPTION 'Etapa 2 do card Brusque não foi criada';
  END IF;

  INSERT INTO public.producao_projeto_grupos(
    projeto_id,project_group_id,quantidade_planejada,origem,ativo
  ) VALUES (
    v_br_project,v_br_group,10,'planejamento',true
  )
  ON CONFLICT(projeto_id,project_group_id)
  DO UPDATE SET
    quantidade_planejada=10,
    origem='planejamento',
    ativo=true,
    updated_at=now();

  -- Reparent administrativo somente da OP29: lote exato de 10 unidades.
  PERFORM set_config('app.reparent_op_admin','on',true);

  UPDATE public.producao_ordens_producao
  SET projeto_id=v_br_project,
      processo_id=v_br_stage2,
      project_group_id=v_br_group,
      atualizado_por_nome_snapshot='Correção TEC-24: OP29 → Brusque',
      updated_at=now()
  WHERE id=v_op29;

  UPDATE public.producao_apontamentos
  SET projeto_local_id=v_br_local,
      processo_id=v_br_stage2,
      updated_at=now()
  WHERE ordem_producao_id=v_op29;

  -- Estruturas por OP, caso existam no futuro ou em ambiente restaurado.
  UPDATE public.producao_programacao_diaria
  SET projeto_id=v_br_project,
      project_group_id=v_br_group,
      processo_id=v_br_stage2,
      updated_at=now()
  WHERE ordem_producao_id=v_op29;

  UPDATE public.producao_necessidades_fabricacao
  SET processo_id=v_br_stage2,
      updated_at=now()
  WHERE ordem_producao_id=v_op29;

  UPDATE public.producao_planejamento_agenda
  SET project_group_id=v_br_group,
      processo_id=v_br_stage2,
      updated_at=now()
  WHERE ordem_producao_id=v_op29;

  UPDATE public.producao_ordens_etapas_auditoria
  SET projeto_id=v_br_project
  WHERE ordem_producao_id=v_op29;

  INSERT INTO public.producao_ordens_etapas_auditoria(
    ordem_producao_id,projeto_id,etapa_origem_id,etapa_destino_id,
    etapa_origem_codigo_snapshot,etapa_origem_nome_snapshot,
    etapa_destino_codigo_snapshot,etapa_destino_nome_snapshot,
    justificativa,apontamentos_reclassificados,
    alterado_por_id,alterado_por_nome_snapshot
  )
  SELECT
    v_op29,v_br_project,v_old_stage2,v_br_stage2,
    origem.codigo,origem.nome,v_br_stage2_code,'Etapa 2',
    'Separação operacional do TEC-24 por cidade: OP 29 corresponde às 10 unidades de Brusque.',
    (SELECT count(*) FROM public.producao_apontamentos WHERE ordem_producao_id=v_op29),
    NULL,'Correção TEC-24: card por cidade'
  FROM public.producao_processos origem
  WHERE origem.id=v_old_stage2;

  -- OPs restantes são Rolândia e permanecem no projeto/etapas originais.
  UPDATE public.producao_ordens_producao
  SET project_group_id=v_rol_group,
      updated_at=now()
  WHERE projeto_id=v_rol_project;

  -- Planejamento: mesma referência TEC-24, cada cidade aponta ao seu card operacional.
  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='TEC-24',
      project_group_id=v_br_group,
      local_utilizacao_id=v_br_local,
      producao_projeto_id=v_br_project,
      quantidade_planejada=10,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='brusque'
    AND i.nome='Bolas penduradas - 80 cm';

  UPDATE public.producao_planejamento_projeto_pecas x
  SET codigo_peca='TEC-24',
      project_group_id=v_rol_group,
      local_utilizacao_id=v_rol_local,
      producao_projeto_id=v_rol_project,
      quantidade_planejada=50,
      updated_at=now()
  FROM public.producao_planejamento_projetos pp,
       public.producao_planejamento_itens i
  WHERE x.planejamento_projeto_id=pp.id
    AND x.planejamento_item_id=i.id
    AND pp.chave='rolandia'
    AND i.nome='Bolas penduradas - 80 cm';

  -- Estado temporal da Etapa 2 de Brusque reflete a OP29 já concluída.
  UPDATE public.producao_processos
  SET status='finalizado',
      data_inicio_real='2026-08-25'::date,
      data_fim_real='2026-08-25'::date,
      finalizado_em=COALESCE(finalizado_em,now()),
      observacoes=concat_ws(E'\n',NULLIF(observacoes,''),
        'Etapa 2 recebeu a OP 29 concluída, lote de 10 unidades destinado a Brusque.'),
      updated_at=now()
  WHERE id=v_br_stage2;
END;
$$;

COMMIT;
