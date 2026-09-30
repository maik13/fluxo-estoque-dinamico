-- Pause releases labor without deleting the pending production record.
ALTER TABLE public.producao_op_jornadas ADD COLUMN IF NOT EXISTS interrompida_em timestamptz;
COMMENT ON COLUMN public.producao_op_jornadas.interrompida_em IS 'Execution stopped here. Open record awaits closure but no longer reserves labor. Resuming stage never restarts this record.';

CREATE OR REPLACE FUNCTION public.interromper_jornadas_etapa_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status IN ('pausado','bloqueado') AND OLD.status IS DISTINCT FROM NEW.status THEN
    WITH afetadas AS (
      UPDATE public.producao_op_jornadas j
      SET interrompida_em=now(), updated_at=now()
      FROM public.producao_ordens_producao o
      WHERE o.id=j.ordem_producao_id AND o.processo_id=NEW.id
        AND j.status='aberta' AND j.interrompida_em IS NULL
      RETURNING j.id,j.ordem_producao_id,j.iniciado_em,j.membros_ids
    )
    INSERT INTO public.producao_ordem_eventos(
      ordem_producao_id,evento,status_anterior,novo_status,usuario_id,nome_usuario_snapshot,dados
    )
    SELECT ordem_producao_id,'jornada_interrompida_etapa','em_execucao','em_execucao',
      auth.uid(),public.nome_usuario_producao(auth.uid()),
      jsonb_build_object('jornada_id',id,'interrompida_em',now(),'membros_ids',membros_ids,
        'processo_id',NEW.id,'status_etapa',NEW.status,'registro_preservado',true)
    FROM afetadas;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.interromper_jornadas_etapa_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER interromper_jornadas_etapa_v1 AFTER UPDATE OF status ON public.producao_processos
FOR EACH ROW EXECUTE FUNCTION public.interromper_jornadas_etapa_v1();

-- Repair all currently paused/blocked stages using the recorded transition time.
WITH afetadas AS (
  UPDATE public.producao_op_jornadas j
  SET interrompida_em=e.data_hora, updated_at=now()
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id=o.processo_id
  JOIN LATERAL (
    SELECT ev.data_hora FROM public.producao_processo_eventos ev
    WHERE ev.processo_id=p.id AND ev.novo_status=p.status
      AND ev.tipo_evento IN ('pausar','bloquear')
    ORDER BY ev.data_hora DESC LIMIT 1
  ) e ON true
  WHERE j.ordem_producao_id=o.id AND j.status='aberta' AND j.interrompida_em IS NULL
    AND p.status IN ('pausado','bloqueado') AND e.data_hora>=j.iniciado_em
  RETURNING j.*
)
INSERT INTO public.producao_ordem_eventos(ordem_producao_id,evento,status_anterior,novo_status,dados)
SELECT ordem_producao_id,'jornada_interrupcao_corrigida','em_execucao','em_execucao',
jsonb_build_object('jornada_id',id,'interrompida_em',interrompida_em,'membros_ids',membros_ids,
 'origem','correcao_pausa_equipe_v1','registro_preservado',true)
FROM afetadas;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.producao_op_jornadas j
 JOIN public.producao_ordens_producao o ON o.id=j.ordem_producao_id
 JOIN public.producao_processos p ON p.id=o.processo_id
 WHERE j.status='aberta' AND j.interrompida_em IS NULL AND p.status IN ('pausado','bloqueado'))
 THEN RAISE EXCEPTION 'Jornada pausada sem evento confiável de interrupção: revisar antes de aplicar'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.listar_membros_ocupados_jornadas_v1()
 RETURNS TABLE(membro_id uuid, membro_nome text, jornada_id uuid, ordem_producao_id uuid, ordem_numero bigint, atividade text, iniciado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  WHERE j.status = 'aberta' AND j.interrompida_em IS NULL
  ORDER BY m.nome, j.iniciado_em;
END;
$function$;

CREATE OR REPLACE FUNCTION public.iniciar_jornada_op_com_equipe_v1(p_ordem_producao_id uuid, p_membros uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Lock stage before OP, matching pause transition, so start cannot race a pause.
  PERFORM p.id FROM public.producao_processos p
  JOIN public.producao_ordens_producao o ON o.processo_id=p.id
  WHERE o.id=p_ordem_producao_id FOR UPDATE OF p;
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
  WHERE j.status = 'aberta' AND j.interrompida_em IS NULL
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

CREATE OR REPLACE FUNCTION public.listar_jornadas_op_abertas_v1()
 RETURNS TABLE(id uuid, ordem_producao_id uuid, iniciado_em timestamp with time zone, iniciado_por_id uuid, iniciado_por_nome_snapshot text, pendente_dia_anterior boolean, tarefa_id uuid, membros_ids uuid[], horarios_membros_rascunho jsonb, termino_rascunho time without time zone, quantidade_produzida_rascunho numeric, minutos_improdutivos_rascunho integer, motivo_improdutivo_rascunho text, observacoes_rascunho text, motivo_regularizacao_rascunho text, justificativa_conclusao_rascunho text, contexto_atualizado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    CASE WHEN j.interrompida_em IS NULL THEN j.termino_rascunho
      ELSE LEAST(j.termino_rascunho,(j.interrompida_em AT TIME ZONE 'America/Sao_Paulo')::time) END,
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
$function$;

CREATE OR REPLACE FUNCTION public.listar_jornadas_op_abertas_v2()
RETURNS TABLE(id uuid, ordem_producao_id uuid, iniciado_em timestamptz, iniciado_por_id uuid,
 iniciado_por_nome_snapshot text, pendente_dia_anterior boolean, tarefa_id uuid, membros_ids uuid[],
 horarios_membros_rascunho jsonb, termino_rascunho time, quantidade_produzida_rascunho numeric,
 minutos_improdutivos_rascunho integer, motivo_improdutivo_rascunho text, observacoes_rascunho text,
 motivo_regularizacao_rascunho text, justificativa_conclusao_rascunho text,
 contexto_atualizado_em timestamptz, interrompida_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT v.*,j.interrompida_em FROM public.listar_jornadas_op_abertas_v1() v
 JOIN public.producao_op_jornadas j ON j.id=v.id;
$$;
REVOKE ALL ON FUNCTION public.listar_jornadas_op_abertas_v2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_jornadas_op_abertas_v2() TO authenticated;
NOTIFY pgrst, 'reload schema';
