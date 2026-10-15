-- Cria somente OPs de atividades originadas do Natal 2026 v24.mpp.
-- O lote é atômico: uma colisão, uma equivalência insegura ou um dado inválido
-- aborta tudo. Nunca atualiza OP, AP, PCP ou histórico pré-existentes.
BEGIN;

CREATE OR REPLACE FUNCTION public.importar_ops_reais_msproject_natal_v24(p_atividades jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_user uuid := auth.uid();
  v_nome_usuario text;
  v_projeto public.producao_projetos%ROWTYPE;
  v_etapa public.producao_processos%ROWTYPE;
  v_tarefa public.producao_tarefas%ROWTYPE;
  v_existente public.producao_ordens_producao%ROWTYPE;
  v_op uuid;
  v_task_uid text;
  v_etapa_numero int;
  v_inicio date;
  v_termino date;
  v_inicio_etapa date;
  v_termino_etapa date;
  v_duracao numeric;
  v_duracao_original numeric;
  v_chave text;
  v_local text;
  v_criadas int := 0;
  v_mantidas int := 0;
  v_etapas_criadas int := 0;
  v_tarefas_criadas int := 0;
  v_task_keys text[] := ARRAY[]::text[];
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Permissão de Produção necessária para importar OPs do MS Project';
  END IF;
  IF jsonb_typeof(p_atividades) <> 'array'
     OR jsonb_array_length(p_atividades) = 0
     OR jsonb_array_length(p_atividades) > 500 THEN
    RAISE EXCEPTION 'Lote inválido: use de 1 a 500 atividades';
  END IF;

  v_nome_usuario := COALESCE(public.nome_usuario_producao(v_user), 'Usuário');

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_atividades)
  LOOP
    v_task_uid := btrim(coalesce(v_item->>'task_uid', ''));
    v_etapa_numero := nullif(v_item->>'etapa', '')::int;
    v_inicio := nullif(v_item->>'inicio', '')::date;
    v_termino := nullif(v_item->>'termino', '')::date;
    v_duracao := nullif(v_item->>'duracao_horas', '')::numeric;
    v_duracao_original := nullif(v_item->>'duracao_horas_original', '')::numeric;
    v_local := btrim(coalesce(v_item->>'local_tipo', ''));

    IF jsonb_typeof(v_item) <> 'object'
       OR v_task_uid !~ '^[0-9]+$'
       OR btrim(coalesce(v_item->>'edt', '')) = ''
       OR btrim(coalesce(v_item->>'codigo_peca', '')) = ''
       OR btrim(coalesce(v_item->>'nome_peca_project', '')) = ''
       OR btrim(coalesce(v_item->>'projeto_nome_completo', '')) = ''
       OR btrim(coalesce(v_item->>'atividade', '')) = ''
       OR btrim(coalesce(v_item->>'categoria_atividade', '')) = ''
       OR v_etapa_numero NOT IN (2, 3, 4, 5)
       OR v_inicio IS NULL OR v_termino IS NULL OR v_termino < v_inicio
       OR (v_duracao IS NOT NULL AND v_duracao <= 0)
       OR (v_duracao_original IS NOT NULL AND v_duracao_original < 0)
       OR v_local NOT IN ('Fábrica', 'Execução')
       OR (v_etapa_numero <= 3 AND v_local <> 'Fábrica')
       OR (v_etapa_numero >= 4 AND v_local <> 'Execução') THEN
      RAISE EXCEPTION 'Atividade MSP inválida para Task UID %', v_task_uid;
    END IF;

    SELECT * INTO STRICT v_projeto
    FROM public.producao_projetos
    WHERE btrim(nome) = btrim(v_item->>'projeto_nome_completo')
      AND COALESCE(excluido_em, NULL) IS NULL;

    IF (v_projeto.id::text || ':' || v_task_uid) = ANY(v_task_keys) THEN
      RAISE EXCEPTION 'Task UID duplicado no lote para o mesmo projeto: %', v_task_uid;
    END IF;
    v_task_keys := array_append(v_task_keys, v_projeto.id::text || ':' || v_task_uid);

    -- Serializa a identidade de origem e a criação da etapa inexistente.
    PERFORM pg_catalog.pg_advisory_xact_lock(hashtextextended(v_projeto.id::text || ':msp-v24:' || v_task_uid, 0));
    PERFORM pg_catalog.pg_advisory_xact_lock(hashtextextended(v_projeto.id::text || ':Etapa ' || v_etapa_numero, 0));

    SELECT * INTO v_etapa
    FROM public.producao_processos
    WHERE projeto_id = v_projeto.id
      AND lower(btrim(nome)) = lower('Etapa ' || v_etapa_numero)
    FOR UPDATE;

    IF NOT FOUND THEN
      IF v_etapa_numero NOT IN (4, 5) THEN
        RAISE EXCEPTION 'Etapa % não cadastrada no projeto %', v_etapa_numero, v_projeto.nome;
      END IF;

      SELECT min(nullif(value->>'inicio', '')::date), max(nullif(value->>'termino', '')::date)
      INTO v_inicio_etapa, v_termino_etapa
      FROM jsonb_array_elements(p_atividades)
      WHERE btrim(value->>'projeto_nome_completo') = btrim(v_projeto.nome)
        AND (value->>'etapa')::int = v_etapa_numero;

      INSERT INTO public.producao_processos (
        codigo, projeto_id, nome, descricao, status, prioridade,
        data_inicio_prevista, data_fim_prevista, data_inicio_desejada, data_limite,
        criado_por_id, criado_por_nome_snapshot, atualizado_por_id,
        atualizado_por_nome_snapshot, grupo_cronograma, sequencia
      ) VALUES (
        public.proximo_codigo_etapa_producao_definitivo(), v_projeto.id,
        'Etapa ' || v_etapa_numero,
        'Etapa criada pela importação rastreável do Natal 2026 v24.',
        'planejado', 'normal', v_inicio_etapa, v_termino_etapa, v_inicio_etapa, v_termino_etapa,
        v_user, v_nome_usuario, v_user, v_nome_usuario, 'Natal 2026', 900 + v_etapa_numero
      ) RETURNING * INTO v_etapa;

      INSERT INTO public.producao_processo_eventos (
        processo_id, tipo_evento, novo_status, usuario_responsavel_id,
        nome_usuario_snapshot, dados_complementares
      ) VALUES (
        v_etapa.id, 'etapa_criada_importacao_msproject_v24', 'planejado', v_user, v_nome_usuario,
        jsonb_build_object('fonte', 'Natal 2026 v24.mpp', 'etapa', v_etapa_numero,
          'inicio_original', v_inicio_etapa, 'termino_original', v_termino_etapa,
          'quantidade_fisica_informada', false, 'equipe_informada', false)
      );
      v_etapas_criadas := v_etapas_criadas + 1;
    ELSIF v_etapa.status IN ('finalizado', 'cancelado') THEN
      RAISE EXCEPTION 'Etapa encerrada: %', v_etapa.id;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(hashtextextended('producao_tarefas:' || lower(btrim(v_item->>'atividade')), 0));
    SELECT * INTO v_tarefa FROM public.producao_tarefas
    WHERE lower(btrim(nome)) = lower(btrim(v_item->>'atividade'))
    FOR UPDATE;
    IF FOUND AND NOT v_tarefa.ativo THEN
      RAISE EXCEPTION 'Atividade existente está inativa: %', v_item->>'atividade';
    ELSIF NOT FOUND THEN
      INSERT INTO public.producao_tarefas (nome, categoria, ativo)
      VALUES (btrim(v_item->>'atividade'), btrim(v_item->>'categoria_atividade'), true)
      RETURNING * INTO v_tarefa;
      v_tarefas_criadas := v_tarefas_criadas + 1;
    END IF;

    v_chave := 'MSP-v24 | Task UID ' || v_task_uid || ' | EDT ' || btrim(v_item->>'edt') || ' | ' || btrim(v_item->>'codigo_peca');
    SELECT * INTO v_existente FROM public.producao_ordens_producao
    WHERE projeto_id = v_projeto.id AND instrucoes LIKE v_chave || ' |%'
    FOR UPDATE;
    IF FOUND THEN
      IF v_existente.processo_id <> v_etapa.id THEN
        RAISE EXCEPTION 'Task UID existente em etapa diferente: %', v_task_uid;
      END IF;
      v_mantidas := v_mantidas + 1;
      CONTINUE;
    END IF;

    -- Não associa nem altera uma OP legada. Se ela já representa a mesma
    -- atividade, etapa, datas e duração, ela é mantida; se só é parecida,
    -- interrompe o lote para conciliação humana, inclusive quando há AP/PCP.
    SELECT * INTO v_existente FROM public.producao_ordens_producao o
    WHERE o.projeto_id = v_projeto.id
      AND o.processo_id = v_etapa.id
      AND lower(btrim(coalesce(o.tarefa_nome_snapshot, o.descricao, ''))) = lower(btrim(v_tarefa.nome))
      AND o.data_inicio_prevista IS NOT DISTINCT FROM v_inicio
      AND o.data_fim_prevista IS NOT DISTINCT FROM v_termino
      AND o.duracao_estimada_horas IS NOT DISTINCT FROM v_duracao
    ORDER BY o.created_at DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      v_mantidas := v_mantidas + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.producao_ordens_producao o
      WHERE o.projeto_id = v_projeto.id AND o.processo_id = v_etapa.id AND o.status <> 'cancelada'
        AND coalesce(o.instrucoes, '') NOT LIKE 'MSP-v24 | Task UID %'
        AND lower(btrim(coalesce(o.tarefa_nome_snapshot, o.descricao, ''))) = lower(btrim(v_tarefa.nome))
    ) THEN
      RAISE EXCEPTION 'OP correlata não confirmada para Task UID %; lote revertido para preservar OP/AP/PCP', v_task_uid;
    END IF;

    INSERT INTO public.producao_ordens_producao (
      processo_id, projeto_id, tarefa_id, tarefa_nome_snapshot, local_tipo,
      descricao, instrucoes, produto_entregavel, unidade_medida, quantidade_planejada,
      data_inicio_prevista, data_fim_prevista, equipe_prevista, duracao_estimada_horas,
      prioridade, status, criado_por_id, criado_por_nome_snapshot,
      atualizado_por_id, atualizado_por_nome_snapshot
    ) VALUES (
      v_etapa.id, v_projeto.id, v_tarefa.id, v_tarefa.nome, v_local,
      v_tarefa.nome,
      v_chave || ' | Peça: ' || btrim(v_item->>'nome_peca_project') || ' | Grupo MSP: ' || btrim(v_item->>'categoria_atividade'),
      v_item->>'nome_peca_project', 'atividade', 1,
      v_inicio, v_termino, NULL, v_duracao,
      'normal', 'liberada', v_user, v_nome_usuario, v_user, v_nome_usuario
    ) RETURNING id INTO v_op;

    INSERT INTO public.producao_ordem_eventos (
      ordem_producao_id, evento, novo_status, usuario_id, nome_usuario_snapshot, dados
    ) VALUES (
      v_op, 'op_importada_msproject_natal_v24', 'liberada', v_user, v_nome_usuario,
      jsonb_build_object('fonte', 'Natal 2026 v24.mpp', 'task_uid', v_task_uid,
        'task_uid_peca', v_item->>'task_uid_peca', 'edt', v_item->>'edt',
        'codigo_peca', v_item->>'codigo_peca', 'nome_peca_project', v_item->>'nome_peca_project',
        'categoria_atividade', v_item->>'categoria_atividade', 'inicio_original', v_inicio,
        'termino_original', v_termino, 'duracao_horas_original', v_duracao_original,
        'percentual_concluido_msp', nullif(v_item->>'percentual_concluido_msp', '')::numeric,
        'quantidade_registro', 1, 'unidade_registro', 'atividade',
        'quantidade_fisica_informada', false, 'equipe_informada', false)
    );
    v_criadas := v_criadas + 1;
  END LOOP;

  RETURN jsonb_build_object('criadas', v_criadas, 'mantidas', v_mantidas,
    'etapas_criadas', v_etapas_criadas, 'tarefas_criadas', v_tarefas_criadas);
END;
$$;

REVOKE ALL ON FUNCTION public.importar_ops_reais_msproject_natal_v24(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_ops_reais_msproject_natal_v24(jsonb) TO authenticated;
COMMENT ON FUNCTION public.importar_ops_reais_msproject_natal_v24(jsonb) IS
  'Importa atomica e autorizadamente atividades do Natal 2026 v24 por Task UID, preservando OPs/APs/PCP existentes.';
NOTIFY pgrst, 'reload schema';

COMMIT;
