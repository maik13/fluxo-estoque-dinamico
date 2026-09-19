BEGIN;

ALTER TABLE public.producao_ordens_producao
  ALTER COLUMN data_inicio_prevista DROP NOT NULL,
  ALTER COLUMN data_fim_prevista DROP NOT NULL;

ALTER TABLE public.producao_ordens_producao
  ADD COLUMN IF NOT EXISTS duracao_estimada_horas NUMERIC(10,2) NULL;

ALTER TABLE public.producao_ordens_producao
  DROP CONSTRAINT IF EXISTS producao_ordens_producao_duracao_estimada_horas_check;

ALTER TABLE public.producao_ordens_producao
  ADD CONSTRAINT producao_ordens_producao_duracao_estimada_horas_check
  CHECK (duracao_estimada_horas IS NULL OR duracao_estimada_horas > 0);

COMMENT ON COLUMN public.producao_ordens_producao.duracao_estimada_horas IS
'Tempo estimado de execução da OP em horas de relógio. O esforço previsto é duração estimada x equipe prevista.';

CREATE OR REPLACE FUNCTION public.criar_ordem_producao_planejada_v1(
  p_processo_id UUID,
  p_tarefa_id UUID,
  p_quantidade_planejada NUMERIC,
  p_local_tipo TEXT,
  p_duracao_estimada_horas NUMERIC,
  p_equipe_prevista INTEGER,
  p_data_inicio_prevista DATE DEFAULT NULL,
  p_data_fim_prevista DATE DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_processo public.producao_processos%ROWTYPE;
  v_tarefa public.producao_tarefas%ROWTYPE;
  v_id UUID;
  v_status TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordens de Produção';
  END IF;

  SELECT * INTO v_tarefa
  FROM public.producao_tarefas
  WHERE id = p_tarefa_id AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecione uma atividade ativa para identificar a OP';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF COALESCE(p_duracao_estimada_horas, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe o tempo estimado de execução da OP em horas';
  END IF;

  IF COALESCE(p_equipe_prevista, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe uma equipe necessária de pelo menos 1 pessoa';
  END IF;

  IF (p_data_inicio_prevista IS NULL) <> (p_data_fim_prevista IS NULL) THEN
    RAISE EXCEPTION 'Informe as duas datas da programação ou deixe ambas em branco';
  END IF;

  IF p_data_inicio_prevista IS NOT NULL
     AND p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'O prazo da OP não pode ser anterior ao início planejado';
  END IF;

  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  SELECT * INTO v_processo
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF v_processo.status IN ('finalizado', 'cancelado') THEN
    RAISE EXCEPTION 'Não é possível emitir OP para uma Etapa encerrada';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);
  v_status := CASE WHEN p_data_inicio_prevista IS NULL THEN 'rascunho' ELSE 'liberada' END;

  INSERT INTO public.producao_ordens_producao (
    processo_id, projeto_id, tarefa_id, tarefa_nome_snapshot, local_tipo,
    descricao, instrucoes, produto_entregavel, unidade_medida,
    quantidade_planejada, duracao_estimada_horas,
    data_inicio_prevista, data_fim_prevista,
    responsavel_id, responsavel_nome_snapshot, equipe_prevista,
    prioridade, status, criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    v_processo.id, v_processo.projeto_id, v_tarefa.id, BTRIM(v_tarefa.nome), p_local_tipo,
    NULLIF(BTRIM(p_descricao), ''), NULLIF(BTRIM(p_instrucoes), ''),
    v_processo.produto_entregavel, v_processo.unidade_medida,
    p_quantidade_planejada, p_duracao_estimada_horas,
    p_data_inicio_prevista, p_data_fim_prevista,
    p_responsavel_id, NULLIF(BTRIM(p_responsavel_nome), ''), p_equipe_prevista,
    p_prioridade, v_status, v_user, v_nome
  )
  RETURNING id INTO v_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, novo_status, usuario_id, nome_usuario_snapshot, dados
  ) VALUES (
    v_id, 'op_planejada_v1', v_status, v_user, v_nome,
    jsonb_build_object(
      'tarefa_id', v_tarefa.id,
      'tarefa_nome_snapshot', BTRIM(v_tarefa.nome),
      'quantidade_planejada', p_quantidade_planejada,
      'duracao_estimada_horas', p_duracao_estimada_horas,
      'equipe_prevista', p_equipe_prevista,
      'esforco_estimado_horas_homem', p_duracao_estimada_horas * p_equipe_prevista,
      'data_inicio_prevista', p_data_inicio_prevista,
      'data_fim_prevista', p_data_fim_prevista,
      'programada', p_data_inicio_prevista IS NOT NULL,
      'versao_rpc', 1
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_ordem_producao_planejada_v1(
  UUID, UUID, NUMERIC, TEXT, NUMERIC, INTEGER, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_ordem_producao_planejada_v1(
  UUID, UUID, NUMERIC, TEXT, NUMERIC, INTEGER, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.editar_ordem_producao_planejamento_v1(
  p_ordem_producao_id UUID,
  p_quantidade_planejada NUMERIC,
  p_local_tipo TEXT,
  p_duracao_estimada_horas NUMERIC,
  p_equipe_prevista INTEGER,
  p_data_inicio_prevista DATE DEFAULT NULL,
  p_data_fim_prevista DATE DEFAULT NULL,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_justificativa TEXT DEFAULT NULL,
  p_tarefa_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
  v_novo_status TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordens de Produção';
  END IF;
  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;
  IF COALESCE(p_duracao_estimada_horas, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe o tempo estimado de execução da OP em horas';
  END IF;
  IF COALESCE(p_equipe_prevista, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe uma equipe necessária de pelo menos 1 pessoa';
  END IF;
  IF (p_data_inicio_prevista IS NULL) <> (p_data_fim_prevista IS NULL) THEN
    RAISE EXCEPTION 'Informe as duas datas da programação ou deixe ambas em branco';
  END IF;
  IF p_data_inicio_prevista IS NOT NULL AND p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'O prazo da OP não pode ser anterior ao início planejado';
  END IF;
  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;
  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;
  IF v_op.status NOT IN ('rascunho', 'liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'Esta OP não permite alteração dos dados de planejamento. Reabra a OP antes da edição';
  END IF;
  IF v_op.status = 'em_execucao' AND p_data_inicio_prevista IS NULL THEN
    RAISE EXCEPTION 'Uma OP em execução não pode ficar sem programação';
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
  ELSIF v_op.tarefa_id IS NOT NULL
        AND p_tarefa_id IS NOT NULL
        AND p_tarefa_id IS DISTINCT FROM v_op.tarefa_id THEN
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

  v_novo_status := CASE
    WHEN v_op.status = 'em_execucao' THEN 'em_execucao'
    WHEN p_data_inicio_prevista IS NULL THEN 'rascunho'
    ELSE 'liberada'
  END;

  v_antes := jsonb_build_object(
    'status', v_op.status,
    'tarefa_id', v_op.tarefa_id,
    'tarefa_nome_snapshot', v_op.tarefa_nome_snapshot,
    'quantidade_planejada', v_op.quantidade_planejada,
    'duracao_estimada_horas', v_op.duracao_estimada_horas,
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
      duracao_estimada_horas = p_duracao_estimada_horas,
      data_inicio_prevista = p_data_inicio_prevista,
      data_fim_prevista = p_data_fim_prevista,
      local_tipo = p_local_tipo,
      responsavel_id = p_responsavel_id,
      responsavel_nome_snapshot = NULLIF(BTRIM(p_responsavel_nome), ''),
      equipe_prevista = p_equipe_prevista,
      prioridade = p_prioridade,
      descricao = NULLIF(BTRIM(p_descricao), ''),
      instrucoes = NULLIF(BTRIM(p_instrucoes), ''),
      status = v_novo_status,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = NOW()
  WHERE id = v_op.id;

  v_depois := jsonb_build_object(
    'status', v_novo_status,
    'tarefa_id', v_tarefa_id,
    'tarefa_nome_snapshot', v_tarefa_nome,
    'quantidade_planejada', p_quantidade_planejada,
    'duracao_estimada_horas', p_duracao_estimada_horas,
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
    v_op.id, 'op_planejamento_editado_v1', v_op.status, v_novo_status,
    v_user, v_nome,
    NULLIF(BTRIM(COALESCE(p_justificativa, '')), ''),
    jsonb_build_object(
      'valores_anteriores', v_antes,
      'valores_posteriores', v_depois,
      'quantidade_confirmada_no_momento', v_realizado,
      'esforco_estimado_horas_homem', p_duracao_estimada_horas * p_equipe_prevista,
      'programada', p_data_inicio_prevista IS NOT NULL,
      'versao_rpc', 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editar_ordem_producao_planejamento_v1(
  UUID, NUMERIC, TEXT, NUMERIC, INTEGER, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_ordem_producao_planejamento_v1(
  UUID, NUMERIC, TEXT, NUMERIC, INTEGER, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_estimativas_ops_v1()
RETURNS TABLE(
  ordem_producao_id UUID,
  duracao_estimada_horas NUMERIC,
  esforco_estimado_horas_homem NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    op.id,
    op.duracao_estimada_horas,
    CASE
      WHEN op.duracao_estimada_horas IS NOT NULL
       AND op.equipe_prevista IS NOT NULL
       AND op.equipe_prevista > 0
      THEN op.duracao_estimada_horas * op.equipe_prevista
      ELSE NULL
    END
  FROM public.producao_ordens_producao op
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY op.numero;
$$;

REVOKE ALL ON FUNCTION public.listar_estimativas_ops_v1()
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_estimativas_ops_v1()
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.transicao_ordem_producao(
  p_ordem_producao_id uuid,
  p_acao text,
  p_justificativa text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
        RAISE EXCEPTION 'Somente uma OP programada pode ser iniciada';
      END IF;
      IF v_op.data_inicio_prevista IS NULL OR v_op.data_fim_prevista IS NULL THEN
        RAISE EXCEPTION 'Programe o início e o prazo da OP antes de iniciar';
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
      IF v_realizado < v_op.quantidade_planejada
         AND BTRIM(COALESCE(p_justificativa,'')) = '' THEN
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
      v_novo := CASE
        WHEN v_ativos > 0 THEN 'em_execucao'
        WHEN v_op.data_inicio_prevista IS NULL OR v_op.data_fim_prevista IS NULL THEN 'rascunho'
        ELSE 'liberada'
      END;
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
    WHERE id = v_op.processo_id AND status = 'planejado';
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
$$;

REVOKE ALL ON FUNCTION public.transicao_ordem_producao(uuid,text,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transicao_ordem_producao(uuid,text,text)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
