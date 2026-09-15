-- Retificação auditável de apontamentos e separação entre OP e apontamento diário.
-- 1) Permite retificar apontamentos pendentes ou conferidos.
-- 2) Apontamento conferido volta para "lancado" e exige nova conferência.
-- 3) Preserva vínculo com a OP e sincroniza a jornada fechada quando houver.
-- 4) Novas jornadas não herdam silenciosamente equipe do apontamento anterior.
-- Não altera apontamentos históricos existentes durante a instalação.

BEGIN;

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS retificado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS retificado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS retificado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS motivo_ultima_retificacao TEXT NULL,
  ADD COLUMN IF NOT EXISTS retificacoes_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.producao_apontamentos
  DROP CONSTRAINT IF EXISTS producao_apontamentos_retificacoes_count_valido;

ALTER TABLE public.producao_apontamentos
  ADD CONSTRAINT producao_apontamentos_retificacoes_count_valido
    CHECK (retificacoes_count >= 0);

CREATE OR REPLACE FUNCTION public.retificar_apontamento_producao_v2(
  p_apontamento_id UUID,
  p_data DATE,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_minutos_improdutivos INTEGER DEFAULT 0,
  p_motivo_improdutivo TEXT DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_membros UUID[] DEFAULT ARRAY[]::UUID[],
  p_horarios_membros JSONB DEFAULT '[]'::JSONB,
  p_motivo_retificacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_atual public.producao_apontamentos%ROWTYPE;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_status_anterior TEXT;
  v_duracao INTEGER;
  v_improdutivos INTEGER := COALESCE(p_minutos_improdutivos, 0);
  v_produtivos INTEGER;
  v_antes JSONB;
  v_depois JSONB;
  v_membro_id UUID;
  v_inicio_em TIMESTAMPTZ;
  v_termino_em TIMESTAMPTZ;
  v_reconferencia BOOLEAN;
  v_agora TIMESTAMPTZ := NOW();
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('editar_apontamento') THEN
    RAISE EXCEPTION 'Sem permissão para retificar apontamentos';
  END IF;

  IF BTRIM(COALESCE(p_motivo_retificacao, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da retificação';
  END IF;

  IF p_data IS NULL OR p_inicio IS NULL OR p_termino IS NULL THEN
    RAISE EXCEPTION 'Informe data, início e término do apontamento';
  END IF;

  IF p_data > (v_agora AT TIME ZONE 'America/Sao_Paulo')::DATE THEN
    RAISE EXCEPTION 'A data do apontamento não pode estar no futuro';
  END IF;

  IF p_termino <= p_inicio THEN
    RAISE EXCEPTION 'O término deve ser posterior ao início';
  END IF;

  IF p_quantidade_produzida IS NOT NULL AND p_quantidade_produzida < 0 THEN
    RAISE EXCEPTION 'Quantidade produzida inválida';
  END IF;

  IF v_improdutivos < 0 THEN
    RAISE EXCEPTION 'Minutos improdutivos inválidos';
  END IF;

  IF v_improdutivos > 0 AND BTRIM(COALESCE(p_motivo_improdutivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;

  IF COALESCE(cardinality(p_membros), 0) = 0 THEN
    RAISE EXCEPTION 'Informe pelo menos um membro da equipe';
  END IF;

  IF p_horarios_membros IS NULL THEN
    p_horarios_membros := '[]'::JSONB;
  END IF;

  IF jsonb_typeof(p_horarios_membros) <> 'array' THEN
    RAISE EXCEPTION 'Horários da equipe em formato inválido';
  END IF;

  SELECT * INTO v_atual
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  IF v_atual.status = 'cancelado' THEN
    RAISE EXCEPTION 'Apontamento cancelado não pode ser retificado';
  END IF;

  IF v_atual.status NOT IN ('lancado', 'conferido') THEN
    RAISE EXCEPTION 'Status do apontamento não permite retificação';
  END IF;

  IF v_atual.ordem_producao_id IS NOT NULL THEN
    SELECT * INTO v_op
    FROM public.producao_ordens_producao
    WHERE id = v_atual.ordem_producao_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A OP vinculada ao apontamento não foi encontrada';
    END IF;

    IF v_op.status IN ('concluida', 'cancelada') THEN
      RAISE EXCEPTION 'Reabra a OP antes de retificar um apontamento já encerrado';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_membros) AS x(membro_id)
    LEFT JOIN public.producao_membros m ON m.id = x.membro_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A equipe contém membro inválido';
  END IF;

  v_duracao := CEIL(EXTRACT(EPOCH FROM (p_termino - p_inicio)) / 60.0)::INTEGER;

  IF v_duracao <= 0 THEN
    RAISE EXCEPTION 'Duração do apontamento inválida';
  END IF;

  IF v_improdutivos > v_duracao THEN
    RAISE EXCEPTION 'O tempo improdutivo não pode ser maior que a duração do apontamento';
  END IF;

  v_produtivos := v_duracao - v_improdutivos;
  v_status_anterior := v_atual.status;
  v_reconferencia := v_status_anterior = 'conferido';
  v_nome := public.nome_usuario_producao(v_user);
  v_antes := to_jsonb(v_atual) - 'updated_at';

  -- Se já estava conferido, qualquer retificação exige nova conferência.
  UPDATE public.producao_apontamentos
     SET status = CASE WHEN v_reconferencia THEN 'lancado' ELSE status END,
         conferido_por_id = CASE WHEN v_reconferencia THEN NULL ELSE conferido_por_id END,
         conferido_por_nome_snapshot = CASE WHEN v_reconferencia THEN NULL ELSE conferido_por_nome_snapshot END,
         conferido_em = CASE WHEN v_reconferencia THEN NULL ELSE conferido_em END,
         data = p_data,
         quantidade_produzida = p_quantidade_produzida,
         inicio = p_inicio,
         termino = p_termino,
         duracao_minutos = v_duracao,
         minutos_produtivos = v_produtivos,
         minutos_improdutivos = v_improdutivos,
         motivo_improdutivo = CASE
           WHEN v_improdutivos > 0 THEN NULLIF(BTRIM(p_motivo_improdutivo), '')
           ELSE NULL
         END,
         observacoes = NULLIF(BTRIM(p_observacoes), ''),
         ultima_edicao_por_id = v_user,
         ultima_edicao_por_nome_snapshot = v_nome,
         ultima_edicao_em = v_agora,
         retificado_em = v_agora,
         retificado_por_id = v_user,
         retificado_por_nome_snapshot = v_nome,
         motivo_ultima_retificacao = BTRIM(p_motivo_retificacao),
         retificacoes_count = COALESCE(retificacoes_count, 0) + 1,
         updated_at = v_agora
   WHERE id = p_apontamento_id;

  DELETE FROM public.producao_apontamento_membros
  WHERE apontamento_id = p_apontamento_id;

  FOREACH v_membro_id IN ARRAY p_membros
  LOOP
    INSERT INTO public.producao_apontamento_membros (
      apontamento_id,
      membro_id
    ) VALUES (
      p_apontamento_id,
      v_membro_id
    );
  END LOOP;

  -- A função já valida se os horários individuais pertencem à equipe e
  -- se permanecem dentro do período geral do apontamento.
  PERFORM public.salvar_horarios_membros_apontamento(
    p_apontamento_id,
    p_horarios_membros
  );

  v_inicio_em := ((p_data + p_inicio) AT TIME ZONE 'America/Sao_Paulo');
  v_termino_em := ((p_data + p_termino) AT TIME ZONE 'America/Sao_Paulo');

  UPDATE public.producao_apontamentos
     SET termino_real_em = CASE
           WHEN jornada_op_id IS NOT NULL THEN v_termino_em
           ELSE termino_real_em
         END,
         updated_at = v_agora
   WHERE id = p_apontamento_id;

  -- Mantém a jornada fechada coerente com o apontamento retificado.
  IF v_atual.jornada_op_id IS NOT NULL THEN
    UPDATE public.producao_op_jornadas
       SET iniciado_em_original = COALESCE(iniciado_em_original, iniciado_em),
           iniciado_em = v_inicio_em,
           inicio_ajustado = TRUE,
           inicio_ajuste_motivo = BTRIM(p_motivo_retificacao),
           inicio_ajustado_por_id = v_user,
           inicio_ajustado_por_nome_snapshot = v_nome,
           inicio_ajustado_em = v_agora,
           inicio_ajuste_retroativo =
             p_data < (v_agora AT TIME ZONE 'America/Sao_Paulo')::DATE,
           encerrado_em = v_termino_em,
           tarefa_id = v_atual.tarefa_id,
           membros_ids = p_membros,
           horarios_membros_rascunho = p_horarios_membros,
           termino_rascunho = p_termino,
           quantidade_produzida_rascunho = p_quantidade_produzida,
           minutos_improdutivos_rascunho = v_improdutivos,
           motivo_improdutivo_rascunho = CASE
             WHEN v_improdutivos > 0 THEN NULLIF(BTRIM(p_motivo_improdutivo), '')
             ELSE NULL
           END,
           observacoes_rascunho = NULLIF(BTRIM(p_observacoes), ''),
           contexto_atualizado_em = v_agora,
           contexto_atualizado_por_id = v_user,
           contexto_atualizado_por_nome_snapshot = v_nome,
           updated_at = v_agora
     WHERE id = v_atual.jornada_op_id;
  END IF;

  SELECT to_jsonb(a) - 'updated_at'
    INTO v_depois
    FROM public.producao_apontamentos a
   WHERE a.id = p_apontamento_id;

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id,
    evento,
    campo_alterado,
    valor_anterior,
    valor_novo,
    usuario_id,
    nome_usuario_snapshot
  ) VALUES (
    p_apontamento_id,
    'retificacao',
    'apontamento_completo',
    jsonb_build_object(
      'dados', v_antes,
      'motivo', BTRIM(p_motivo_retificacao),
      'status_anterior', v_status_anterior
    )::TEXT,
    jsonb_build_object(
      'dados', v_depois,
      'motivo', BTRIM(p_motivo_retificacao),
      'reconferencia_obrigatoria', v_reconferencia
    )::TEXT,
    v_user,
    v_nome
  );

  RETURN jsonb_build_object(
    'apontamento_id', p_apontamento_id,
    'status_anterior', v_status_anterior,
    'status_novo', CASE WHEN v_reconferencia THEN 'lancado' ELSE v_status_anterior END,
    'reconferencia_obrigatoria', v_reconferencia,
    'retificado_em', v_agora
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retificar_apontamento_producao_v2(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.retificar_apontamento_producao_v2(
  UUID, DATE, NUMERIC, TIME, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, TEXT
) TO authenticated;

-- Nova jornada = novo apontamento. Não herda silenciosamente equipe anterior.
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
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para iniciar apontamento em Ordem de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'Somente uma OP liberada ou em execução pode iniciar um apontamento';
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
        'origem', 'inicio_apontamento_op_v2',
        'iniciado_em', v_iniciado_em
      )
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
    ARRAY[]::UUID[],
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
      'membros_herdados', 0,
      'novo_apontamento_independente', TRUE
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

REVOKE ALL ON FUNCTION public.iniciar_jornada_op_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_jornada_op_v1(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  TO_REGPROCEDURE(
    'public.retificar_apontamento_producao_v2(uuid,date,numeric,time without time zone,time without time zone,integer,text,text,uuid[],jsonb,text)'
  ) AS rpc_retificar_apontamento,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_apontamentos'
      AND column_name = 'retificacoes_count'
  ) AS auditoria_retificacao_instalada,
  TO_REGPROCEDURE('public.iniciar_jornada_op_v1(uuid)') AS rpc_iniciar_apontamento,
  (SELECT COUNT(*) FROM public.producao_apontamentos) AS apontamentos_preservados,
  (SELECT COUNT(*) FROM public.producao_op_jornadas WHERE status = 'aberta') AS jornadas_abertas_preservadas;
