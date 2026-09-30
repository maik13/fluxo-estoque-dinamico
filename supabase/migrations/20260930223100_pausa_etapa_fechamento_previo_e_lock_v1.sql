-- Permit closing work performed before pause, without allowing new execution during pause.
CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(p_data date, p_ordem_producao_id uuid, p_processo_id uuid, p_projeto_local_id uuid, p_tarefa_id uuid, p_local_tipo text, p_quantidade_produzida numeric, p_inicio time without time zone, p_termino time without time zone, p_duracao_minutos integer, p_minutos_produtivos integer, p_minutos_improdutivos integer, p_motivo_improdutivo text, p_observacoes text, p_membros uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_id UUID;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_processo_id UUID;
  v_projeto_local_id UUID;
  v_local_tipo TEXT;
  v_membro RECORD;
  v_quantidade_aberta NUMERIC;
  v_e_pintura BOOLEAN := FALSE;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para lançar apontamentos';
  END IF;

  IF p_data IS NULL THEN RAISE EXCEPTION 'Data obrigatória'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;
  IF COALESCE(p_minutos_produtivos,0) + COALESCE(p_minutos_improdutivos,0) <> p_duracao_minutos THEN
    RAISE EXCEPTION 'A soma dos tempos deve ser igual à duração';
  END IF;
  IF COALESCE(p_minutos_improdutivos,0) > 0
     AND BTRIM(COALESCE(p_motivo_improdutivo,'')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;
  IF COALESCE(CARDINALITY(p_membros),0) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um membro';
  END IF;
  IF p_quantidade_produzida IS NOT NULL AND p_quantidade_produzida < 0 THEN
    RAISE EXCEPTION 'Quantidade produzida inválida';
  END IF;

  IF p_ordem_producao_id IS NOT NULL THEN
    PERFORM p.id FROM public.producao_processos p
    JOIN public.producao_ordens_producao o ON o.processo_id=p.id
    WHERE o.id=p_ordem_producao_id FOR UPDATE OF p;
    SELECT * INTO v_op
    FROM public.producao_ordens_producao
    WHERE id = p_ordem_producao_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de Produção não encontrada'; END IF;
    IF v_op.status NOT IN ('liberada','em_execucao') THEN
      RAISE EXCEPTION 'A OP não está liberada para apontamentos';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.producao_processos p
      WHERE p.id = v_op.processo_id
        AND (
          p.status IN ('finalizado','cancelado')
          OR (p.status IN ('pausado','bloqueado') AND NOT EXISTS (
            SELECT 1 FROM public.producao_op_jornadas j
            WHERE j.ordem_producao_id=v_op.id AND j.status='aberta'
              AND j.interrompida_em IS NOT NULL
              AND (j.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date=p_data
              AND (j.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::time(0)=p_inicio
              AND ((p_data+p_termino) AT TIME ZONE 'America/Sao_Paulo')<=j.interrompida_em
              AND (SELECT array_agg(x ORDER BY x) FROM unnest(j.membros_ids) x)
                = (SELECT array_agg(x ORDER BY x) FROM unnest(p_membros) x)
          ))
        )
    ) THEN
      RAISE EXCEPTION 'A Etapa da OP não está disponível para execução';
    END IF;

    v_e_pintura := public.ordem_producao_e_pintura_v1(v_op.id);

    -- A trava de saldo continua valendo para todas as OPs comuns.
    -- Em pintura a quantidade é a quantidade de peças cobertas naquela demão,
    -- portanto pode se repetir na 1ª, 2ª, 3ª... demão.
    IF NOT v_e_pintura THEN
      SELECT COALESCE(SUM(a.quantidade_produzida),0)
      INTO v_quantidade_aberta
      FROM public.producao_apontamentos a
      WHERE a.ordem_producao_id = v_op.id
        AND a.status <> 'cancelado';

      IF p_quantidade_produzida IS NOT NULL
         AND v_quantidade_aberta + p_quantidade_produzida > v_op.quantidade_planejada THEN
        RAISE EXCEPTION
          'A quantidade ultrapassa o saldo da OP. Saldo disponível: %',
          GREATEST(v_op.quantidade_planejada - v_quantidade_aberta, 0);
      END IF;
    ELSE
      IF p_quantidade_produzida IS NULL OR p_quantidade_produzida <= 0 THEN
        RAISE EXCEPTION 'Informe a quantidade de peças pintadas nesta demão';
      END IF;
      IF p_quantidade_produzida > v_op.quantidade_planejada THEN
        RAISE EXCEPTION
          'A quantidade pintada nesta demão não pode ultrapassar as % peças planejadas na OP',
          v_op.quantidade_planejada;
      END IF;
    END IF;

    IF p_processo_id IS NOT NULL AND p_processo_id <> v_op.processo_id THEN
      RAISE EXCEPTION 'A Etapa informada não corresponde à OP';
    END IF;

    v_processo_id := v_op.processo_id;
    v_projeto_local_id := NULL;
    v_local_tipo := v_op.local_tipo;

    UPDATE public.producao_processos
    SET status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
        data_inicio_real = CASE WHEN status = 'planejado' THEN COALESCE(data_inicio_real, p_data) ELSE data_inicio_real END,
        updated_at = NOW()
    WHERE id = v_op.processo_id;
  ELSE
    IF p_processo_id IS NOT NULL OR p_projeto_local_id IS NULL THEN
      RAISE EXCEPTION 'Apontamento planejado exige uma OP. Para atividade avulsa, informe somente o projeto/local';
    END IF;
    IF p_local_tipo NOT IN ('Fábrica','Execução') THEN RAISE EXCEPTION 'Local inválido'; END IF;
    v_processo_id := NULL;
    v_projeto_local_id := p_projeto_local_id;
    v_local_tipo := p_local_tipo;
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_apontamentos (
    data, ordem_producao_id, processo_id, projeto_local_id, tarefa_id, local_tipo,
    quantidade_produzida, inicio, termino, duracao_minutos, minutos_produtivos,
    minutos_improdutivos, motivo_improdutivo, observacoes,
    criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    p_data, p_ordem_producao_id, v_processo_id, v_projeto_local_id, p_tarefa_id, v_local_tipo,
    p_quantidade_produzida, p_inicio, p_termino, p_duracao_minutos, p_minutos_produtivos,
    p_minutos_improdutivos, NULLIF(BTRIM(p_motivo_improdutivo),''),
    NULLIF(BTRIM(p_observacoes),''), v_user, v_nome
  ) RETURNING id INTO v_id;

  FOR v_membro IN
    SELECT m.id, m.nome, m.valor_hora, m.jornada_diaria_minutos
    FROM public.producao_membros m
    WHERE m.id = ANY(p_membros) AND m.ativo = TRUE
  LOOP
    INSERT INTO public.producao_apontamento_membros (
      apontamento_id, membro_id, nome_snapshot, valor_hora_snapshot,
      jornada_diaria_minutos_snapshot, minutos_produtivos_snapshot, minutos_improdutivos_snapshot
    ) VALUES (
      v_id, v_membro.id, v_membro.nome, v_membro.valor_hora,
      v_membro.jornada_diaria_minutos, p_minutos_produtivos, p_minutos_improdutivos
    );
  END LOOP;

  IF (
    SELECT COUNT(*) FROM public.producao_apontamento_membros
    WHERE apontamento_id = v_id
  ) <> CARDINALITY(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  ) VALUES (
    v_id, 'criacao', v_user, v_nome,
    jsonb_build_object(
      'ordem_producao_id', p_ordem_producao_id,
      'processo_id', v_processo_id,
      'projeto_local_id', v_projeto_local_id
    )::TEXT
  );

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_contexto_jornada_op_v1(p_jornada_id uuid, p_tarefa_id uuid, p_membros uuid[] DEFAULT ARRAY[]::uuid[], p_horarios_membros jsonb DEFAULT '[]'::jsonb, p_termino time without time zone DEFAULT NULL::time without time zone, p_quantidade_produzida numeric DEFAULT NULL::numeric, p_minutos_improdutivos integer DEFAULT 0, p_motivo_improdutivo text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_motivo_regularizacao text DEFAULT NULL::text, p_justificativa_conclusao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
  v_membros_atuais UUID[];
  v_membros_novos UUID[];
BEGIN
  -- Consistent order: stage, then journey/OP, also used by pause.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  JOIN public.producao_op_jornadas j ON j.ordem_producao_id=o.id
  WHERE j.id=p_jornada_id FOR UPDATE OF p;
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
      WHERE j.status = 'aberta' AND j.interrompida_em IS NULL
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

  IF v_jornada.interrompida_em IS NOT NULL AND p_termino IS NOT NULL AND
    (((v_jornada.iniciado_em AT TIME ZONE 'America/Sao_Paulo')::date + p_termino)
       AT TIME ZONE 'America/Sao_Paulo') > v_jornada.interrompida_em THEN
    RAISE EXCEPTION 'O término não pode ultrapassar a pausa da etapa';
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
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_v1(p_jornada_id uuid, p_tarefa_id uuid, p_quantidade_produzida numeric, p_termino time without time zone, p_minutos_improdutivos integer DEFAULT 0, p_motivo_improdutivo text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_membros uuid[] DEFAULT ARRAY[]::uuid[], p_horarios_membros jsonb DEFAULT '[]'::jsonb, p_concluir_op boolean DEFAULT false, p_motivo_regularizacao text DEFAULT NULL::text, p_justificativa_conclusao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Consistent order: stage, then journey/OP, also used by pause.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  JOIN public.producao_op_jornadas j ON j.ordem_producao_id=o.id
  WHERE j.id=p_jornada_id FOR UPDATE OF p;
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

  IF v_jornada.interrompida_em IS NOT NULL THEN
    IF (SELECT array_agg(x ORDER BY x) FROM unnest(v_membros) x)
       IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(v_jornada.membros_ids) x) THEN
      RAISE EXCEPTION 'Preserve a equipe do trabalho realizado antes da pausa';
    END IF;
    IF v_termino_em > v_jornada.interrompida_em THEN
      RAISE EXCEPTION 'O término não pode ultrapassar a pausa da etapa';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_horarios) h
      WHERE (((v_data + (h->>'termino')::time) AT TIME ZONE 'America/Sao_Paulo')
        > v_jornada.interrompida_em)
    ) THEN RAISE EXCEPTION 'O término individual da equipe não pode ultrapassar a pausa da etapa'; END IF;
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_inicio_jornada_op_v1(p_jornada_id uuid, p_nova_data date, p_novo_inicio time without time zone, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
  v_anterior TIMESTAMPTZ;
  v_original TIMESTAMPTZ;
  v_novo TIMESTAMPTZ;
  v_agora TIMESTAMPTZ := NOW();
  v_retroativo BOOLEAN;
BEGIN
  -- Consistent order: stage, then journey/OP, also used by pause.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  JOIN public.producao_op_jornadas j ON j.ordem_producao_id=o.id
  WHERE j.id=p_jornada_id FOR UPDATE OF p;
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para ajustar o início da jornada';
  END IF;

  IF p_nova_data IS NULL OR p_novo_inicio IS NULL THEN
    RAISE EXCEPTION 'Informe a data e o horário reais de início';
  END IF;

  IF BTRIM(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste do início';
  END IF;

  SELECT * INTO v_jornada
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada da OP não encontrada';
  END IF;

  IF v_jornada.status <> 'aberta' THEN
    RAISE EXCEPTION 'Somente uma jornada aberta pode ter o início ajustado';
  END IF;

  v_anterior := v_jornada.iniciado_em;
  v_original := COALESCE(v_jornada.iniciado_em_original, v_jornada.iniciado_em);
  v_novo := ((p_nova_data + p_novo_inicio) AT TIME ZONE 'America/Sao_Paulo');

  IF v_novo > v_agora + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'O início real não pode estar no futuro';
  END IF;

  v_retroativo := p_nova_data < (v_agora AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_op_jornadas
     SET iniciado_em_original = v_original,
         iniciado_em = v_novo,
         inicio_ajustado = TRUE,
         inicio_ajuste_motivo = BTRIM(p_motivo),
         inicio_ajustado_por_id = v_user,
         inicio_ajustado_por_nome_snapshot = v_nome,
         inicio_ajustado_em = v_agora,
         inicio_ajuste_retroativo = v_retroativo,
         updated_at = NOW()
   WHERE id = p_jornada_id;

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
    v_jornada.ordem_producao_id,
    'jornada_inicio_ajustado',
    'em_execucao',
    'em_execucao',
    v_user,
    v_nome,
    BTRIM(p_motivo),
    jsonb_build_object(
      'jornada_id', p_jornada_id,
      'iniciado_em_original', v_original,
      'iniciado_em_anterior', v_anterior,
      'iniciado_em_ajustado', v_novo,
      'data_real', p_nova_data,
      'hora_real', p_novo_inicio,
      'ajuste_registrado_em', v_agora,
      'retroativo', v_retroativo
    )
  );

  RETURN jsonb_build_object(
    'jornada_id', p_jornada_id,
    'iniciado_em', v_novo,
    'iniciado_em_original', v_original,
    'data', p_nova_data,
    'inicio', p_novo_inicio,
    'ajustado_em', v_agora,
    'retroativo', v_retroativo
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.descartar_jornada_op_v1(p_jornada_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_jornada public.producao_op_jornadas%ROWTYPE;
  v_agora TIMESTAMPTZ;
BEGIN
  -- Consistent order: stage, then journey/OP, also used by pause.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  JOIN public.producao_op_jornadas j ON j.ordem_producao_id=o.id
  WHERE j.id=p_jornada_id FOR UPDATE OF p;
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
$function$;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_com_consumos_v2(p_jornada_id uuid, p_tarefa_id uuid, p_quantidade_produzida numeric, p_termino time without time zone, p_minutos_improdutivos integer, p_motivo_improdutivo text, p_observacoes text, p_membros uuid[], p_horarios_membros jsonb, p_concluir_op boolean, p_motivo_regularizacao text, p_justificativa_conclusao text, p_consumos_tinta jsonb, p_demao_numero integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ordem_producao_id uuid;
  v_resultado jsonb;
  v_apontamento_id uuid;
  v_finalizacao jsonb := null;
  v_consumo_resultado jsonb := null;
  v_e_pintura boolean := false;
  v_demao_efetiva integer;
begin
  -- Stage first: pause updates the journey while holding this same stage lock.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  JOIN public.producao_op_jornadas j ON j.ordem_producao_id=o.id
  WHERE j.id=p_jornada_id FOR UPDATE OF p;
  select ordem_producao_id into v_ordem_producao_id
  from public.producao_op_jornadas
  where id = p_jornada_id
  for update;

  if not found then
    raise exception 'Jornada da OP não encontrada';
  end if;

  v_e_pintura := public.ordem_producao_e_pintura_v1(v_ordem_producao_id);

  if v_e_pintura then
    v_demao_efetiva := coalesce(
      p_demao_numero,
      public.proxima_demao_pintura_v1(v_ordem_producao_id)
    );

    perform public.validar_demao_pintura_lote_v1(
      v_ordem_producao_id,
      v_demao_efetiva,
      p_quantidade_produzida
    );

    if p_consumos_tinta is null
       or jsonb_typeof(p_consumos_tinta) <> 'array'
       or jsonb_array_length(p_consumos_tinta) = 0 then
      raise exception 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    end if;
  else
    v_demao_efetiva := null;
  end if;

  v_resultado := public.finalizar_jornada_op_v1(
    p_jornada_id => p_jornada_id,
    p_tarefa_id => p_tarefa_id,
    p_quantidade_produzida => p_quantidade_produzida,
    p_termino => p_termino,
    p_minutos_improdutivos => p_minutos_improdutivos,
    p_motivo_improdutivo => p_motivo_improdutivo,
    p_observacoes => p_observacoes,
    p_membros => p_membros,
    p_horarios_membros => p_horarios_membros,
    p_concluir_op => false,
    p_motivo_regularizacao => p_motivo_regularizacao,
    p_justificativa_conclusao => p_justificativa_conclusao
  );

  v_apontamento_id := (v_resultado ->> 'apontamento_id')::uuid;

  if v_e_pintura then
    update public.producao_apontamentos
    set demao_numero = v_demao_efetiva
    where id = v_apontamento_id;

    v_consumo_resultado := public.registrar_consumos_tinta_op_v1(
      v_ordem_producao_id, v_apontamento_id, p_consumos_tinta
    );
  end if;

  if p_concluir_op then
    v_finalizacao := public.finalizar_ordem_producao_com_conferencia_v1(
      v_ordem_producao_id,
      nullif(btrim(p_justificativa_conclusao), '')
    );
  end if;

  return v_resultado || jsonb_build_object(
    'demao_numero', case when v_e_pintura then v_demao_efetiva else null end,
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao,
    'consumo_tinta', v_consumo_resultado
  );
end;
$function$;

ALTER TABLE public.producao_op_jornadas ADD CONSTRAINT producao_jornada_interrupcao_apos_inicio
 CHECK(interrompida_em IS NULL OR interrompida_em>=iniciado_em);
NOTIFY pgrst,'reload schema';
