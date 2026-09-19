BEGIN;

CREATE OR REPLACE FUNCTION public.listar_consumos_tinta_historico_v1()
RETURNS TABLE(
  id UUID,
  ordem_producao_id UUID,
  apontamento_id UUID,
  cor TEXT,
  quantidade_ml NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.usuario_tem_permissao_producao('visualizar')
    OR public.usuario_tem_permissao_producao('lancar')
    OR public.usuario_tem_permissao_producao('processos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar consumo de tinta';
  END IF;

  RETURN QUERY
  SELECT c.id, c.ordem_producao_id, c.apontamento_id, c.cor, c.quantidade_ml, c.created_at
  FROM public.producao_consumos_tinta c
  ORDER BY c.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_consumos_tinta_historico_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_consumos_tinta_historico_v1()
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_consumo_tinta_por_projeto_v1()
RETURNS TABLE(
  projeto_id UUID,
  consumo_tinta_ml NUMERIC,
  registros_tinta INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.usuario_tem_permissao_producao('visualizar')
    OR public.usuario_tem_permissao_producao('processos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o consumo de tinta do Gerencial';
  END IF;

  RETURN QUERY
  SELECT
    op.projeto_id,
    ROUND(COALESCE(SUM(c.quantidade_ml), 0), 2)::NUMERIC,
    COUNT(c.id)::INTEGER
  FROM public.producao_consumos_tinta c
  JOIN public.producao_ordens_producao op ON op.id = c.ordem_producao_id
  WHERE c.quantidade_ml > 0
    AND op.projeto_id IS NOT NULL
  GROUP BY op.projeto_id
  ORDER BY op.projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_consumo_tinta_por_projeto_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_consumo_tinta_por_projeto_v1()
TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.listar_membros_ocupados_jornadas_v1();

CREATE FUNCTION public.listar_membros_ocupados_jornadas_v1()
RETURNS TABLE(
  membro_id UUID,
  membro_nome TEXT,
  jornada_id UUID,
  ordem_producao_id UUID,
  ordem_numero BIGINT,
  atividade TEXT,
  iniciado_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.usuario_tem_permissao_producao('visualizar')
    OR public.usuario_tem_permissao_producao('lancar')
    OR public.usuario_tem_permissao_producao('processos')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar alocação da equipe';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.nome,
    j.id,
    j.ordem_producao_id,
    op.numero::BIGINT,
    COALESCE(NULLIF(op.tarefa_nome_snapshot, ''), NULLIF(op.descricao, ''), 'OP ' || op.numero::TEXT),
    j.iniciado_em
  FROM public.producao_op_jornadas j
  JOIN public.producao_ordens_producao op ON op.id = j.ordem_producao_id
  CROSS JOIN LATERAL unnest(COALESCE(j.membros_ids, ARRAY[]::UUID[])) x(membro_id)
  JOIN public.producao_membros m ON m.id = x.membro_id
  WHERE j.status = 'aberta'
  ORDER BY m.nome, j.iniciado_em;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_membros_ocupados_jornadas_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_membros_ocupados_jornadas_v1()
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.iniciar_jornada_op_com_equipe_v1(
  p_ordem_producao_id UUID,
  p_membros UUID[]
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
  v_membros UUID[];
  v_conflito_nome TEXT;
  v_conflito_op BIGINT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para iniciar apontamento em Ordem de Produção';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::UUID[])
  INTO v_membros
  FROM unnest(COALESCE(p_membros, ARRAY[]::UUID[])) x;

  IF COALESCE(cardinality(v_membros), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um membro da equipe antes de iniciar a OP';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'Somente uma OP programada ou em execução pode iniciar um apontamento';
  END IF;

  IF v_op.data_inicio_prevista IS NULL OR v_op.data_fim_prevista IS NULL THEN
    RAISE EXCEPTION 'Programe o início e o prazo da OP antes de iniciar';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.producao_processos p
    WHERE p.id = v_op.processo_id
      AND p.status IN ('pausado', 'bloqueado', 'finalizado', 'cancelado')
  ) THEN
    RAISE EXCEPTION 'A Etapa da OP não está disponível para execução';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.producao_op_jornadas j
    WHERE j.ordem_producao_id = v_op.id
      AND j.status = 'aberta'
  ) THEN
    RAISE EXCEPTION 'Esta OP já possui um apontamento em aberto';
  END IF;

  PERFORM m.id
  FROM public.producao_membros m
  WHERE m.id = ANY(v_membros)
  ORDER BY m.id
  FOR UPDATE;

  IF (
    SELECT COUNT(*)
    FROM public.producao_membros m
    WHERE m.id = ANY(v_membros)
      AND m.ativo = TRUE
  ) <> cardinality(v_membros) THEN
    RAISE EXCEPTION 'A equipe selecionada contém membro inexistente ou inativo';
  END IF;

  SELECT m.nome, op.numero
  INTO v_conflito_nome, v_conflito_op
  FROM public.producao_op_jornadas j
  JOIN public.producao_ordens_producao op ON op.id = j.ordem_producao_id
  CROSS JOIN LATERAL unnest(COALESCE(j.membros_ids, ARRAY[]::UUID[])) x(membro_id)
  JOIN public.producao_membros m ON m.id = x.membro_id
  WHERE j.status = 'aberta'
    AND x.membro_id = ANY(v_membros)
  ORDER BY j.iniciado_em
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION '% já está alocado(a) na OP % e ficará disponível após o encerramento desse apontamento',
      v_conflito_nome,
      LPAD(v_conflito_op::TEXT, 5, '0');
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

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
      jsonb_build_object(
        'origem', 'inicio_apontamento_com_equipe_v1',
        'iniciado_em', v_iniciado_em,
        'membros_ids', to_jsonb(v_membros)
      )
    );
  END IF;

  INSERT INTO public.producao_op_jornadas (
    ordem_producao_id, iniciado_em, iniciado_por_id, iniciado_por_nome_snapshot,
    tarefa_id, membros_ids, horarios_membros_rascunho
  ) VALUES (
    v_op.id, v_iniciado_em, v_user, v_nome,
    v_op.tarefa_id, v_membros, '[]'::JSONB
  )
  RETURNING id INTO v_jornada_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, dados
  ) VALUES (
    v_op.id, 'jornada_iniciada_com_equipe', 'em_execucao', 'em_execucao',
    v_user, v_nome,
    jsonb_build_object(
      'jornada_id', v_jornada_id,
      'iniciado_em', v_iniciado_em,
      'tarefa_id', v_op.tarefa_id,
      'membros_ids', to_jsonb(v_membros),
      'quantidade_membros', cardinality(v_membros)
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', v_jornada_id,
    'ordem_producao_id', v_op.id,
    'iniciado_em', v_iniciado_em,
    'status_op', 'em_execucao',
    'membros_ids', to_jsonb(v_membros)
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta OP já possui um apontamento em aberto';
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_jornada_op_com_equipe_v1(UUID, UUID[])
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_op_com_equipe_v1(UUID, UUID[])
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.iniciar_jornada_op_v1(p_ordem_producao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Selecione a equipe antes de iniciar a OP';
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_jornada_op_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_op_v1(UUID)
TO authenticated, service_role;

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
  v_membros_atuais UUID[];
  v_membros_novos UUID[];
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
     AND NOT EXISTS (SELECT 1 FROM public.producao_tarefas t WHERE t.id = p_tarefa_id) THEN
    RAISE EXCEPTION 'Atividade informada não existe';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::UUID[])
  INTO v_membros_atuais
  FROM unnest(COALESCE(v_jornada.membros_ids, ARRAY[]::UUID[])) x;

  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::UUID[])
  INTO v_membros_novos
  FROM unnest(COALESCE(p_membros, ARRAY[]::UUID[])) x;

  IF cardinality(v_membros_atuais) > 0
     AND v_membros_novos IS DISTINCT FROM v_membros_atuais THEN
    RAISE EXCEPTION 'A equipe desta execução foi definida no início da OP e não pode ser alterada enquanto o apontamento estiver aberto';
  END IF;

  IF cardinality(v_membros_atuais) = 0 AND cardinality(v_membros_novos) > 0 THEN
    PERFORM m.id
    FROM public.producao_membros m
    WHERE m.id = ANY(v_membros_novos)
    ORDER BY m.id
    FOR UPDATE;

    IF (
      SELECT COUNT(*) FROM public.producao_membros m
      WHERE m.id = ANY(v_membros_novos)
        AND m.ativo = TRUE
    ) <> cardinality(v_membros_novos) THEN
      RAISE EXCEPTION 'A equipe selecionada contém membro inexistente ou inativo';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.producao_op_jornadas j
      CROSS JOIN LATERAL unnest(COALESCE(j.membros_ids, ARRAY[]::UUID[])) x(membro_id)
      WHERE j.status = 'aberta'
        AND j.id <> v_jornada.id
        AND x.membro_id = ANY(v_membros_novos)
    ) THEN
      RAISE EXCEPTION 'Um dos membros selecionados já está alocado em outra OP em execução';
    END IF;

    v_membros_atuais := v_membros_novos;
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
      membros_ids = v_membros_atuais,
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

REVOKE ALL ON FUNCTION public.salvar_contexto_jornada_op_v1(
  UUID, UUID, UUID[], JSONB, TIME, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_contexto_jornada_op_v1(
  UUID, UUID, UUID[], JSONB, TIME, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  p_jornada_id UUID,
  p_tarefa_id UUID,
  p_quantidade_produzida NUMERIC,
  p_termino TIME WITHOUT TIME ZONE,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_horarios_membros JSONB,
  p_concluir_op BOOLEAN,
  p_motivo_regularizacao TEXT,
  p_justificativa_conclusao TEXT,
  p_consumos_tinta JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem_producao_id UUID;
  v_membros_jornada UUID[];
  v_resultado JSONB;
  v_apontamento_id UUID;
  v_finalizacao JSONB := NULL;
  v_consumo_resultado JSONB := NULL;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  SELECT ordem_producao_id, COALESCE(membros_ids, ARRAY[]::UUID[])
  INTO v_ordem_producao_id, v_membros_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  IF cardinality(v_membros_jornada) = 0 THEN
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), ARRAY[]::UUID[])
    INTO v_membros_jornada
    FROM unnest(COALESCE(p_membros, ARRAY[]::UUID[])) x;
  END IF;

  IF cardinality(v_membros_jornada) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um membro da equipe';
  END IF;

  v_resultado := public.finalizar_jornada_op_v1(
    p_jornada_id => p_jornada_id,
    p_tarefa_id => p_tarefa_id,
    p_quantidade_produzida => p_quantidade_produzida,
    p_termino => p_termino,
    p_minutos_improdutivos => p_minutos_improdutivos,
    p_motivo_improdutivo => p_motivo_improdutivo,
    p_observacoes => p_observacoes,
    p_membros => v_membros_jornada,
    p_horarios_membros => p_horarios_membros,
    p_concluir_op => FALSE,
    p_motivo_regularizacao => p_motivo_regularizacao,
    p_justificativa_conclusao => p_justificativa_conclusao
  );

  v_apontamento_id := (v_resultado ->> 'apontamento_id')::UUID;

  IF jsonb_array_length(p_consumos_tinta) > 0 THEN
    v_consumo_resultado := public.registrar_consumos_tinta_op_v1(
      v_ordem_producao_id, v_apontamento_id, p_consumos_tinta
    );
  END IF;

  IF p_concluir_op THEN
    v_finalizacao := public.finalizar_ordem_producao_com_conferencia_v1(
      v_ordem_producao_id,
      NULLIF(BTRIM(p_justificativa_conclusao), '')
    );
  END IF;

  RETURN v_resultado || jsonb_build_object(
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao,
    'consumo_tinta', v_consumo_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_com_consumos_v1(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.finalizar_jornada_op_v1(
  UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_v1(
  UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.descartar_jornada_op_v1(
  p_jornada_id UUID,
  p_motivo TEXT
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
  v_agora TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para descartar apontamento aberto';
  END IF;

  IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo para descartar o apontamento aberto';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento aberto não encontrado';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Somente um apontamento ainda aberto pode ser descartado';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);
  v_agora := GREATEST(
    clock_timestamp(),
    v_jornada.iniciado_em + INTERVAL '1 millisecond'
  );

  UPDATE public.producao_op_jornadas
  SET status = 'encerrada',
      encerrado_em = v_agora,
      encerrado_registrado_em = v_agora,
      encerrado_por_id = v_user,
      encerrado_por_nome_snapshot = v_nome,
      descartada = TRUE,
      descartada_em = v_agora,
      descartada_por_id = v_user,
      descartada_por_nome_snapshot = v_nome,
      motivo_descarte = BTRIM(p_motivo),
      updated_at = v_agora
  WHERE id = p_jornada_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa, dados
  ) VALUES (
    v_jornada.ordem_producao_id,
    'apontamento_aberto_descartado',
    'em_execucao',
    'em_execucao',
    v_user,
    v_nome,
    BTRIM(p_motivo),
    jsonb_build_object(
      'jornada_id', v_jornada.id,
      'iniciado_em', v_jornada.iniciado_em,
      'quantidade_rascunho', v_jornada.quantidade_produzida_rascunho,
      'membros_ids', v_jornada.membros_ids,
      'descartada_em', v_agora
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', v_jornada.id,
    'ordem_producao_id', v_jornada.ordem_producao_id,
    'descartada', TRUE,
    'descartada_em', v_agora
  );
END;
$$;

REVOKE ALL ON FUNCTION public.descartar_jornada_op_v1(UUID, TEXT)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.descartar_jornada_op_v1(UUID, TEXT)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
