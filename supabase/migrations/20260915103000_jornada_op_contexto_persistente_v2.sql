-- Persistência do contexto da jornada de OP.
-- Objetivo: ao reabrir o fechamento de uma jornada, atividade, equipe e dados já informados
-- continuam preenchidos. Não altera/reprocessa OPs ou apontamentos históricos.

BEGIN;

ALTER TABLE public.producao_op_jornadas
  ADD COLUMN IF NOT EXISTS tarefa_id UUID NULL
    REFERENCES public.producao_tarefas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS membros_ids UUID[] NULL,
  ADD COLUMN IF NOT EXISTS horarios_membros_rascunho JSONB NULL,
  ADD COLUMN IF NOT EXISTS termino_rascunho TIME NULL,
  ADD COLUMN IF NOT EXISTS quantidade_produzida_rascunho NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS minutos_improdutivos_rascunho INTEGER NULL,
  ADD COLUMN IF NOT EXISTS motivo_improdutivo_rascunho TEXT NULL,
  ADD COLUMN IF NOT EXISTS observacoes_rascunho TEXT NULL,
  ADD COLUMN IF NOT EXISTS motivo_regularizacao_rascunho TEXT NULL,
  ADD COLUMN IF NOT EXISTS justificativa_conclusao_rascunho TEXT NULL,
  ADD COLUMN IF NOT EXISTS contexto_atualizado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS contexto_atualizado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS contexto_atualizado_por_nome_snapshot TEXT NULL;

ALTER TABLE public.producao_op_jornadas
  DROP CONSTRAINT IF EXISTS producao_op_jornadas_quantidade_rascunho_valida,
  DROP CONSTRAINT IF EXISTS producao_op_jornadas_improdutivos_rascunho_validos;

ALTER TABLE public.producao_op_jornadas
  ADD CONSTRAINT producao_op_jornadas_quantidade_rascunho_valida
    CHECK (quantidade_produzida_rascunho IS NULL OR quantidade_produzida_rascunho >= 0),
  ADD CONSTRAINT producao_op_jornadas_improdutivos_rascunho_validos
    CHECK (minutos_improdutivos_rascunho IS NULL OR minutos_improdutivos_rascunho >= 0);

CREATE OR REPLACE FUNCTION public.membros_ultimo_apontamento_op_v1(
  p_ordem_producao_id UUID
)
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    ARRAY_AGG(pam.membro_id ORDER BY pam.created_at)
      FILTER (WHERE pam.membro_id IS NOT NULL),
    ARRAY[]::UUID[]
  )
  FROM public.producao_apontamento_membros pam
  WHERE pam.apontamento_id = (
    SELECT a.id
    FROM public.producao_apontamentos a
    WHERE a.ordem_producao_id = p_ordem_producao_id
      AND a.status <> 'cancelado'
    ORDER BY a.data DESC, a.created_at DESC
    LIMIT 1
  );
$$;

REVOKE ALL ON FUNCTION public.membros_ultimo_apontamento_op_v1(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.iniciar_jornada_op_v1(
  p_ordem_producao_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_jornada_id UUID;
  v_iniciado_em TIMESTAMPTZ := NOW();
  v_membros UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para iniciar trabalho em Ordem de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'Somente uma OP liberada ou em execução pode iniciar uma jornada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.producao_processos p
    WHERE p.id = v_op.processo_id
      AND p.status IN ('pausado', 'bloqueado', 'finalizado', 'cancelado')
  ) THEN
    RAISE EXCEPTION 'A Etapa da OP não está disponível para execução';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.producao_op_jornadas j
    WHERE j.ordem_producao_id = v_op.id
      AND j.status = 'aberta'
  ) THEN
    RAISE EXCEPTION 'Esta OP já possui um apontamento em aberto';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);
  v_membros := public.membros_ultimo_apontamento_op_v1(v_op.id);

  IF COALESCE(cardinality(v_membros), 0) = 0
     AND v_op.responsavel_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.producao_membros m
       WHERE m.id = v_op.responsavel_id
     ) THEN
    v_membros := ARRAY[v_op.responsavel_id]::UUID[];
  END IF;

  IF v_op.status = 'liberada' THEN
    UPDATE public.producao_ordens_producao
       SET status = 'em_execucao',
           data_inicio_real = COALESCE(data_inicio_real, CURRENT_DATE),
           atualizado_por_id = v_user,
           atualizado_por_nome_snapshot = v_nome,
           updated_at = NOW()
     WHERE id = v_op.id;

    UPDATE public.producao_processos
       SET status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
           data_inicio_real = CASE
             WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE)
             ELSE data_inicio_real
           END,
           updated_at = NOW()
     WHERE id = v_op.processo_id;

    INSERT INTO public.producao_ordem_eventos (
      ordem_producao_id, evento, status_anterior, novo_status,
      usuario_id, nome_usuario_snapshot, dados
    ) VALUES (
      v_op.id, 'iniciar', v_op.status, 'em_execucao',
      v_user, v_nome,
      jsonb_build_object('origem', 'inicio_jornada_op_v1', 'iniciado_em', v_iniciado_em)
    );
  END IF;

  INSERT INTO public.producao_op_jornadas (
    ordem_producao_id,
    iniciado_em,
    iniciado_por_id,
    iniciado_por_nome_snapshot,
    tarefa_id,
    membros_ids,
    horarios_membros_rascunho
  ) VALUES (
    v_op.id,
    v_iniciado_em,
    v_user,
    v_nome,
    v_op.tarefa_id,
    v_membros,
    '[]'::JSONB
  )
  RETURNING id INTO v_jornada_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, dados
  ) VALUES (
    v_op.id, 'jornada_iniciada', 'em_execucao', 'em_execucao',
    v_user, v_nome,
    jsonb_build_object(
      'jornada_id', v_jornada_id,
      'iniciado_em', v_iniciado_em,
      'tarefa_id', v_op.tarefa_id,
      'membros_herdados', COALESCE(cardinality(v_membros), 0)
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', v_jornada_id,
    'ordem_producao_id', v_op.id,
    'iniciado_em', v_iniciado_em,
    'status_op', 'em_execucao'
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta OP já possui um apontamento em aberto';
END;
$$;

DROP FUNCTION IF EXISTS public.listar_jornadas_op_abertas_v1();

CREATE FUNCTION public.listar_jornadas_op_abertas_v1()
RETURNS TABLE(
  id UUID,
  ordem_producao_id UUID,
  iniciado_em TIMESTAMPTZ,
  iniciado_por_id UUID,
  iniciado_por_nome_snapshot TEXT,
  pendente_dia_anterior BOOLEAN,
  tarefa_id UUID,
  membros_ids UUID[],
  horarios_membros_rascunho JSONB,
  termino_rascunho TIME,
  quantidade_produzida_rascunho NUMERIC,
  minutos_improdutivos_rascunho INTEGER,
  motivo_improdutivo_rascunho TEXT,
  observacoes_rascunho TEXT,
  motivo_regularizacao_rascunho TEXT,
  justificativa_conclusao_rascunho TEXT,
  contexto_atualizado_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT (
    public.usuario_tem_permissao_producao('visualizar')
    OR public.usuario_tem_permissao_producao('lancar')
    OR public.usuario_tem_permissao_producao('processos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar jornadas das OPs';
  END IF;

  RETURN QUERY
  SELECT
    j.id,
    j.ordem_producao_id,
    j.iniciado_em,
    j.iniciado_por_id,
    j.iniciado_por_nome_snapshot,
    ((j.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::DATE
      < (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE) AS pendente_dia_anterior,
    COALESCE(j.tarefa_id, o.tarefa_id) AS tarefa_id,
    COALESCE(
      j.membros_ids,
      NULLIF(public.membros_ultimo_apontamento_op_v1(o.id), ARRAY[]::UUID[]),
      CASE
        WHEN o.responsavel_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM public.producao_membros m
           WHERE m.id = o.responsavel_id
         )
        THEN ARRAY[o.responsavel_id]::UUID[]
        ELSE ARRAY[]::UUID[]
      END
    ) AS membros_ids,
    COALESCE(j.horarios_membros_rascunho, '[]'::JSONB),
    j.termino_rascunho,
    j.quantidade_produzida_rascunho,
    j.minutos_improdutivos_rascunho,
    j.motivo_improdutivo_rascunho,
    j.observacoes_rascunho,
    j.motivo_regularizacao_rascunho,
    j.justificativa_conclusao_rascunho,
    j.contexto_atualizado_em
  FROM public.producao_op_jornadas j
  JOIN public.producao_ordens_producao o ON o.id = j.ordem_producao_id
  WHERE j.status = 'aberta'
  ORDER BY j.iniciado_em;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_contexto_jornada_op_v1(
  p_jornada_id UUID,
  p_tarefa_id UUID,
  p_membros UUID[] DEFAULT ARRAY[]::UUID[],
  p_horarios_membros JSONB DEFAULT '[]'::JSONB,
  p_termino TIME DEFAULT NULL,
  p_quantidade_produzida NUMERIC DEFAULT NULL,
  p_minutos_improdutivos INTEGER DEFAULT 0,
  p_motivo_improdutivo TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_motivo_regularizacao TEXT DEFAULT NULL,
  p_justificativa_conclusao TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para salvar o contexto da jornada';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Somente jornadas abertas podem receber alterações de contexto';
  END IF;

  IF p_tarefa_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.producao_tarefas t WHERE t.id = p_tarefa_id
     ) THEN
    RAISE EXCEPTION 'Atividade informada não existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_membros, ARRAY[]::UUID[])) AS x(membro_id)
    LEFT JOIN public.producao_membros m ON m.id = x.membro_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A equipe contém membro inválido';
  END IF;

  IF p_horarios_membros IS NULL THEN
    p_horarios_membros := '[]'::JSONB;
  END IF;

  IF jsonb_typeof(p_horarios_membros) <> 'array' THEN
    RAISE EXCEPTION 'Horários da equipe em formato inválido';
  END IF;

  IF p_quantidade_produzida IS NOT NULL AND p_quantidade_produzida < 0 THEN
    RAISE EXCEPTION 'Quantidade produzida inválida';
  END IF;

  IF COALESCE(p_minutos_improdutivos, 0) < 0 THEN
    RAISE EXCEPTION 'Minutos improdutivos inválidos';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_op_jornadas
     SET tarefa_id = p_tarefa_id,
         membros_ids = COALESCE(p_membros, ARRAY[]::UUID[]),
         horarios_membros_rascunho = p_horarios_membros,
         termino_rascunho = p_termino,
         quantidade_produzida_rascunho = p_quantidade_produzida,
         minutos_improdutivos_rascunho = COALESCE(p_minutos_improdutivos, 0),
         motivo_improdutivo_rascunho = NULLIF(BTRIM(p_motivo_improdutivo), ''),
         observacoes_rascunho = NULLIF(BTRIM(p_observacoes), ''),
         motivo_regularizacao_rascunho = NULLIF(BTRIM(p_motivo_regularizacao), ''),
         justificativa_conclusao_rascunho = NULLIF(BTRIM(p_justificativa_conclusao), ''),
         contexto_atualizado_em = NOW(),
         contexto_atualizado_por_id = v_user,
         contexto_atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = p_jornada_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_v1(
  p_jornada_id UUID,
  p_tarefa_id UUID,
  p_quantidade_produzida NUMERIC,
  p_termino TIME,
  p_minutos_improdutivos INTEGER DEFAULT 0,
  p_motivo_improdutivo TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_membros UUID[] DEFAULT ARRAY[]::UUID[],
  p_horarios_membros JSONB DEFAULT '[]'::JSONB,
  p_concluir_op BOOLEAN DEFAULT FALSE,
  p_motivo_regularizacao TEXT DEFAULT NULL,
  p_justificativa_conclusao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_data DATE;
  v_inicio TIME;
  v_termino_em TIMESTAMPTZ;
  v_agora TIMESTAMPTZ := NOW();
  v_duracao INTEGER;
  v_improdutivos INTEGER;
  v_retroativo BOOLEAN;
  v_apontamento_id UUID;
  v_finalizacao JSONB := NULL;
  v_tarefa_id UUID;
  v_membros UUID[];
  v_horarios JSONB;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para registrar apontamentos da Produção';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Esta jornada já foi encerrada';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = v_jornada.ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status <> 'em_execucao' THEN
    RAISE EXCEPTION 'A OP precisa estar em execução para encerrar a jornada';
  END IF;

  v_tarefa_id := COALESCE(p_tarefa_id, v_jornada.tarefa_id, v_op.tarefa_id);
  v_membros := CASE
    WHEN COALESCE(cardinality(p_membros), 0) > 0 THEN p_membros
    ELSE COALESCE(v_jornada.membros_ids, ARRAY[]::UUID[])
  END;
  v_horarios := COALESCE(p_horarios_membros, '[]'::JSONB);

  IF jsonb_typeof(v_horarios) <> 'array' THEN
    RAISE EXCEPTION 'Horários da equipe em formato inválido';
  END IF;

  IF v_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Informe a atividade executada';
  END IF;

  IF p_termino IS NULL THEN
    RAISE EXCEPTION 'Informe o horário real de término';
  END IF;

  IF COALESCE(cardinality(v_membros), 0) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um membro da equipe';
  END IF;

  v_data := (v_jornada.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_inicio := (v_jornada.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::TIME(0);
  v_termino_em := ((v_data + p_termino) AT TIME ZONE 'America/Sao_Paulo');

  IF v_termino_em <= v_jornada.iniciado_em THEN
    RAISE EXCEPTION 'O término deve ser posterior ao horário em que a jornada foi iniciada';
  END IF;

  IF v_termino_em > v_agora + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'O horário de término não pode estar no futuro';
  END IF;

  v_duracao := CEIL(EXTRACT(EPOCH FROM (v_termino_em - v_jornada.iniciado_em)) / 60.0)::INTEGER;
  v_improdutivos := COALESCE(p_minutos_improdutivos, 0);

  IF v_improdutivos < 0 OR v_improdutivos > v_duracao THEN
    RAISE EXCEPTION 'O tempo improdutivo deve estar entre zero e a duração da jornada';
  END IF;

  IF v_improdutivos > 0 AND BTRIM(COALESCE(p_motivo_improdutivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;

  v_retroativo := v_data < (v_agora AT TIME ZONE 'America/Sao_Paulo')::DATE;

  IF v_retroativo AND BTRIM(COALESCE(p_motivo_regularizacao, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do fechamento retroativo';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  v_apontamento_id := public.criar_apontamento_producao_com_horarios(
    p_data => v_data,
    p_ordem_producao_id => v_op.id,
    p_processo_id => v_op.processo_id,
    p_projeto_local_id => NULL,
    p_tarefa_id => v_tarefa_id,
    p_local_tipo => v_op.local_tipo,
    p_quantidade_produzida => p_quantidade_produzida,
    p_inicio => v_inicio,
    p_termino => p_termino,
    p_duracao_minutos => v_duracao,
    p_minutos_produtivos => v_duracao - v_improdutivos,
    p_minutos_improdutivos => v_improdutivos,
    p_motivo_improdutivo => NULLIF(BTRIM(p_motivo_improdutivo), ''),
    p_observacoes => NULLIF(BTRIM(p_observacoes), ''),
    p_membros => v_membros,
    p_horarios_membros => v_horarios
  );

  UPDATE public.producao_apontamentos
     SET jornada_op_id = v_jornada.id,
         termino_real_em = v_termino_em,
         fechamento_retroativo = v_retroativo,
         motivo_regularizacao = CASE
           WHEN v_retroativo THEN BTRIM(p_motivo_regularizacao)
           ELSE NULL
         END,
         regularizado_por_id = CASE WHEN v_retroativo THEN v_user ELSE NULL END,
         regularizado_por_nome_snapshot = CASE WHEN v_retroativo THEN v_nome ELSE NULL END,
         regularizado_em = CASE WHEN v_retroativo THEN v_agora ELSE NULL END,
         updated_at = NOW()
   WHERE id = v_apontamento_id;

  UPDATE public.producao_op_jornadas
     SET status = 'encerrada',
         encerrado_em = v_termino_em,
         encerrado_registrado_em = v_agora,
         encerrado_por_id = v_user,
         encerrado_por_nome_snapshot = v_nome,
         apontamento_id = v_apontamento_id,
         fechamento_retroativo = v_retroativo,
         motivo_regularizacao = CASE
           WHEN v_retroativo THEN BTRIM(p_motivo_regularizacao)
           ELSE NULL
         END,
         tarefa_id = v_tarefa_id,
         membros_ids = v_membros,
         horarios_membros_rascunho = v_horarios,
         termino_rascunho = p_termino,
         quantidade_produzida_rascunho = p_quantidade_produzida,
         minutos_improdutivos_rascunho = v_improdutivos,
         motivo_improdutivo_rascunho = NULLIF(BTRIM(p_motivo_improdutivo), ''),
         observacoes_rascunho = NULLIF(BTRIM(p_observacoes), ''),
         motivo_regularizacao_rascunho = NULLIF(BTRIM(p_motivo_regularizacao), ''),
         justificativa_conclusao_rascunho = NULLIF(BTRIM(p_justificativa_conclusao), ''),
         contexto_atualizado_em = v_agora,
         contexto_atualizado_por_id = v_user,
         contexto_atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = v_jornada.id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa, dados
  ) VALUES (
    v_op.id,
    CASE WHEN v_retroativo THEN 'jornada_encerrada_retroativa' ELSE 'jornada_encerrada' END,
    'em_execucao',
    'em_execucao',
    v_user,
    v_nome,
    CASE WHEN v_retroativo THEN BTRIM(p_motivo_regularizacao) ELSE NULL END,
    jsonb_build_object(
      'jornada_id', v_jornada.id,
      'apontamento_id', v_apontamento_id,
      'iniciado_em', v_jornada.iniciado_em,
      'termino_real_em', v_termino_em,
      'encerrado_registrado_em', v_agora,
      'fechamento_retroativo', v_retroativo
    )
  );

  IF p_concluir_op THEN
    IF NOT public.usuario_tem_permissao_producao('processos') THEN
      RAISE EXCEPTION 'Sem permissão para concluir a Ordem de Produção';
    END IF;

    v_finalizacao := public.finalizar_ordem_producao_com_conferencia_v1(
      v_op.id,
      NULLIF(BTRIM(p_justificativa_conclusao), '')
    );
  END IF;

  RETURN jsonb_build_object(
    'jornada_id', v_jornada.id,
    'apontamento_id', v_apontamento_id,
    'ordem_producao_id', v_op.id,
    'fechamento_retroativo', v_retroativo,
    'termino_real_em', v_termino_em,
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao
  );
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_jornada_op_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_jornadas_op_abertas_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_contexto_jornada_op_v1(UUID, UUID, UUID[], JSONB, TIME, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_jornada_op_v1(UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.iniciar_jornada_op_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_jornadas_op_abertas_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_contexto_jornada_op_v1(UUID, UUID, UUID[], JSONB, TIME, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_v1(UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMENT ON COLUMN public.producao_op_jornadas.membros_ids IS
'Equipe associada ao contexto da jornada. É herdada do último apontamento da mesma OP quando houver e pode ser ajustada antes do fechamento.';
COMMENT ON COLUMN public.producao_op_jornadas.contexto_atualizado_em IS
'Momento do último salvamento do rascunho operacional da jornada.';

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_op_jornadas'
      AND column_name = 'membros_ids'
  ) AS contexto_equipe_instalado,
  TO_REGPROCEDURE(
    'public.salvar_contexto_jornada_op_v1(uuid,uuid,uuid[],jsonb,time without time zone,numeric,integer,text,text,text,text)'
  ) AS rpc_salvar_contexto,
  TO_REGPROCEDURE('public.listar_jornadas_op_abertas_v1()') AS rpc_listar_contexto,
  (SELECT COUNT(*) FROM public.producao_op_jornadas) AS jornadas_totais_preservadas,
  (SELECT COUNT(*) FROM public.producao_op_jornadas WHERE status = 'aberta') AS jornadas_abertas_preservadas;