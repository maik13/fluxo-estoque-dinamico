-- Remove justificativa obrigatória para editar, reabrir e reclassificar OP.
-- Cancelamento e conclusão parcial continuam exigindo justificativa.

BEGIN;

ALTER TABLE public.producao_ordens_etapas_auditoria
  ALTER COLUMN justificativa DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.editar_ordem_producao_v2(
  p_ordem_producao_id uuid,
  p_quantidade_planejada numeric,
  p_data_inicio_prevista date,
  p_data_fim_prevista date,
  p_local_tipo text,
  p_responsavel_id uuid DEFAULT NULL::uuid,
  p_responsavel_nome text DEFAULT NULL::text,
  p_equipe_prevista integer DEFAULT NULL::integer,
  p_instrucoes text DEFAULT NULL::text,
  p_descricao text DEFAULT NULL::text,
  p_prioridade text DEFAULT 'normal'::text,
  p_justificativa text DEFAULT NULL::text,
  p_tarefa_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_tarefa public.producao_tarefas%ROWTYPE;
  v_tarefa_id UUID;
  v_tarefa_nome TEXT;
  v_realizado NUMERIC := 0;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordens de Produção';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF p_data_inicio_prevista IS NULL OR p_data_fim_prevista IS NULL OR p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'Informe um período planejado válido para a OP';
  END IF;

  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_equipe_prevista IS NOT NULL AND p_equipe_prevista < 0 THEN
    RAISE EXCEPTION 'Equipe prevista inválida';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'Somente OP liberada ou em execução pode ser editada. Reabra a OP antes da edição';
  END IF;

  v_tarefa_id := v_op.tarefa_id;
  v_tarefa_nome := v_op.tarefa_nome_snapshot;

  IF v_op.tarefa_id IS NULL AND p_tarefa_id IS NOT NULL THEN
    SELECT * INTO v_tarefa
    FROM public.producao_tarefas
    WHERE id = p_tarefa_id AND ativo = TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selecione uma atividade ativa para identificar a OP';
    END IF;

    v_tarefa_id := v_tarefa.id;
    v_tarefa_nome := BTRIM(v_tarefa.nome);
  ELSIF v_op.tarefa_id IS NOT NULL AND p_tarefa_id IS NOT NULL AND p_tarefa_id IS DISTINCT FROM v_op.tarefa_id THEN
    RAISE EXCEPTION 'A atividade que identifica a OP não pode ser alterada depois de definida';
  END IF;

  SELECT COALESCE(SUM(a.quantidade_produzida), 0)
    INTO v_realizado
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = v_op.id
     AND a.status = 'conferido';

  IF p_quantidade_planejada < v_realizado THEN
    RAISE EXCEPTION 'A quantidade planejada não pode ser menor que a produção já confirmada. Produção confirmada: %', v_realizado;
  END IF;

  v_antes := jsonb_build_object(
    'tarefa_id', v_op.tarefa_id,
    'tarefa_nome_snapshot', v_op.tarefa_nome_snapshot,
    'quantidade_planejada', v_op.quantidade_planejada,
    'data_inicio_prevista', v_op.data_inicio_prevista,
    'data_fim_prevista', v_op.data_fim_prevista,
    'local_tipo', v_op.local_tipo,
    'responsavel_id', v_op.responsavel_id,
    'responsavel_nome_snapshot', v_op.responsavel_nome_snapshot,
    'equipe_prevista', v_op.equipe_prevista,
    'prioridade', v_op.prioridade,
    'descricao', v_op.descricao,
    'instrucoes', v_op.instrucoes
  );

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
     SET tarefa_id = v_tarefa_id,
         tarefa_nome_snapshot = v_tarefa_nome,
         quantidade_planejada = p_quantidade_planejada,
         data_inicio_prevista = p_data_inicio_prevista,
         data_fim_prevista = p_data_fim_prevista,
         local_tipo = p_local_tipo,
         responsavel_id = p_responsavel_id,
         responsavel_nome_snapshot = NULLIF(BTRIM(p_responsavel_nome), ''),
         equipe_prevista = p_equipe_prevista,
         prioridade = p_prioridade,
         descricao = NULLIF(BTRIM(p_descricao), ''),
         instrucoes = NULLIF(BTRIM(p_instrucoes), ''),
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = v_op.id;

  v_depois := jsonb_build_object(
    'tarefa_id', v_tarefa_id,
    'tarefa_nome_snapshot', v_tarefa_nome,
    'quantidade_planejada', p_quantidade_planejada,
    'data_inicio_prevista', p_data_inicio_prevista,
    'data_fim_prevista', p_data_fim_prevista,
    'local_tipo', p_local_tipo,
    'responsavel_id', p_responsavel_id,
    'responsavel_nome_snapshot', NULLIF(BTRIM(p_responsavel_nome), ''),
    'equipe_prevista', p_equipe_prevista,
    'prioridade', p_prioridade,
    'descricao', NULLIF(BTRIM(p_descricao), ''),
    'instrucoes', NULLIF(BTRIM(p_instrucoes), '')
  );

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa, dados
  ) VALUES (
    v_op.id, 'op_editada_v2', v_op.status, v_op.status,
    v_user, v_nome,
    NULLIF(BTRIM(COALESCE(p_justificativa, '')), ''),
    jsonb_build_object(
      'valores_anteriores', v_antes,
      'valores_posteriores', v_depois,
      'quantidade_confirmada_no_momento', v_realizado,
      'versao_rpc', 2
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transicao_ordem_producao(
  p_ordem_producao_id uuid,
  p_acao text,
  p_justificativa text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_novo TEXT;
  v_pendentes INTEGER;
  v_ativos INTEGER;
  v_realizado NUMERIC;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar Ordens de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE a.status = 'lancado'),
    COUNT(*) FILTER (WHERE a.status <> 'cancelado'),
    COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0)
  INTO v_pendentes, v_ativos, v_realizado
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id;

  CASE p_acao
    WHEN 'iniciar' THEN
      IF v_op.status <> 'liberada' THEN
        RAISE EXCEPTION 'Somente uma OP liberada pode ser iniciada';
      END IF;
      v_novo := 'em_execucao';

    WHEN 'concluir' THEN
      IF v_op.status NOT IN ('liberada','em_execucao') THEN
        RAISE EXCEPTION 'A OP não está aberta para conclusão';
      END IF;
      IF v_pendentes > 0 THEN
        RAISE EXCEPTION 'Existem apontamentos pendentes de conferência nesta OP';
      END IF;
      IF v_ativos = 0 THEN
        RAISE EXCEPTION 'A OP não possui apontamentos válidos';
      END IF;
      IF v_realizado < v_op.quantidade_planejada AND BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A quantidade realizada é menor que a planejada. Informe uma justificativa';
      END IF;
      v_novo := 'concluida';

    WHEN 'cancelar' THEN
      IF v_op.status IN ('concluida','cancelada') THEN
        RAISE EXCEPTION 'A OP já está encerrada';
      END IF;
      IF BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A justificativa é obrigatória';
      END IF;
      IF v_ativos > 0 THEN
        RAISE EXCEPTION 'Cancele os apontamentos da OP antes de cancelá-la';
      END IF;
      v_novo := 'cancelada';

    WHEN 'reabrir' THEN
      IF v_op.status NOT IN ('concluida','cancelada') THEN
        RAISE EXCEPTION 'Somente uma OP encerrada pode ser reaberta';
      END IF;
      v_novo := CASE WHEN v_ativos > 0 THEN 'em_execucao' ELSE 'liberada' END;

    ELSE
      RAISE EXCEPTION 'Ação de OP desconhecida';
  END CASE;

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
     SET status = v_novo,
         data_inicio_real = CASE
           WHEN p_acao = 'iniciar' THEN COALESCE(data_inicio_real, CURRENT_DATE)
           ELSE data_inicio_real
         END,
         data_fim_real = CASE
           WHEN p_acao = 'concluir' THEN CURRENT_DATE
           WHEN p_acao = 'reabrir' THEN NULL
           ELSE data_fim_real
         END,
         motivo_cancelamento = CASE
           WHEN p_acao = 'cancelar' THEN BTRIM(p_justificativa)
           WHEN p_acao = 'reabrir' THEN NULL
           ELSE motivo_cancelamento
         END,
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = v_op.id;

  IF p_acao = 'iniciar' THEN
    UPDATE public.producao_processos
       SET status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
           data_inicio_real = CASE
             WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE)
             ELSE data_inicio_real
           END,
           updated_at = NOW()
     WHERE id = v_op.processo_id
       AND status = 'planejado';
  END IF;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    v_op.id, p_acao, v_op.status, v_novo,
    v_user, v_nome,
    NULLIF(BTRIM(COALESCE(p_justificativa, '')), '')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reclassificar_ordem_producao_etapa_v1(
  p_ordem_producao_id uuid,
  p_nova_etapa_id uuid,
  p_justificativa text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_nome_usuario text;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_etapa_origem public.producao_processos%ROWTYPE;
  v_etapa_destino public.producao_processos%ROWTYPE;
  v_qtd_apontamentos integer := 0;
  v_justificativa text := NULLIF(btrim(COALESCE(p_justificativa, '')), '');
BEGIN
  IF v_user IS NULL OR NOT (public.is_admin() OR public.usuario_tem_permissao_producao('processos')) THEN
    RAISE EXCEPTION 'Sem permissão para alterar a etapa da Ordem de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  SELECT * INTO v_etapa_origem
  FROM public.producao_processos
  WHERE id = v_op.processo_id;

  SELECT * INTO v_etapa_destino
  FROM public.producao_processos
  WHERE id = p_nova_etapa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa de destino não encontrada';
  END IF;

  IF v_etapa_destino.projeto_id IS DISTINCT FROM v_op.projeto_id THEN
    RAISE EXCEPTION 'A nova etapa precisa pertencer ao mesmo projeto da OP';
  END IF;

  IF v_etapa_destino.status = 'cancelado' THEN
    RAISE EXCEPTION 'Não é possível mover a OP para uma etapa cancelada';
  END IF;

  IF v_op.processo_id = p_nova_etapa_id THEN
    RETURN jsonb_build_object(
      'alterada', false,
      'ordem_producao_id', v_op.id,
      'etapa_id', v_op.processo_id,
      'apontamentos_reclassificados', 0
    );
  END IF;

  SELECT COALESCE(NULLIF(p.nome, ''), p.email, v_user::text)
    INTO v_nome_usuario
    FROM public.profiles p
   WHERE p.user_id = v_user
   LIMIT 1;

  v_nome_usuario := COALESCE(v_nome_usuario, v_user::text);
  PERFORM set_config('app.reclassificar_op_etapa', 'on', true);

  UPDATE public.producao_ordens_producao
     SET processo_id = p_nova_etapa_id,
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome_usuario,
         updated_at = now()
   WHERE id = v_op.id;

  UPDATE public.producao_apontamentos
     SET processo_id = p_nova_etapa_id,
         updated_at = now()
   WHERE ordem_producao_id = v_op.id
     AND processo_id IS DISTINCT FROM p_nova_etapa_id;

  GET DIAGNOSTICS v_qtd_apontamentos = ROW_COUNT;

  INSERT INTO public.producao_ordens_etapas_auditoria (
    ordem_producao_id, projeto_id, etapa_origem_id, etapa_destino_id,
    justificativa, apontamentos_reclassificados,
    alterado_por_id, alterado_por_nome_snapshot
  ) VALUES (
    v_op.id, v_op.projeto_id, v_op.processo_id, p_nova_etapa_id,
    v_justificativa, v_qtd_apontamentos,
    v_user, v_nome_usuario
  );

  UPDATE public.producao_processos
     SET updated_at = now()
   WHERE id IN (v_op.processo_id, p_nova_etapa_id);

  RETURN jsonb_build_object(
    'alterada', true,
    'ordem_producao_id', v_op.id,
    'etapa_origem_id', v_op.processo_id,
    'etapa_origem_nome', v_etapa_origem.nome,
    'etapa_destino_id', p_nova_etapa_id,
    'etapa_destino_nome', v_etapa_destino.nome,
    'apontamentos_reclassificados', v_qtd_apontamentos
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
