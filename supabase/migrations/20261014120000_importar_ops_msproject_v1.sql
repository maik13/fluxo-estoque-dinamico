-- Importação transacional das OPs do MS Project. Cria apenas OPs ausentes;
-- não cria projeto/etapa/tarefa nem altera OP, AP, histórico ou PCP existentes.
-- Task UID é a identidade imutável da tarefa no .mpp; EDT é só referência.

BEGIN;

CREATE OR REPLACE FUNCTION public.importar_ops_msproject_v1(p_atividades jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_user uuid := auth.uid();
  v_projeto public.producao_projetos%ROWTYPE;
  v_etapa public.producao_processos%ROWTYPE;
  v_tarefa public.producao_tarefas%ROWTYPE;
  v_existente public.producao_ordens_producao%ROWTYPE;
  v_nova uuid;
  v_task_uid text;
  v_chave text;
  v_criadas int := 0;
  v_mantidas int := 0;
  v_task_uids text[] := ARRAY[]::text[];
  v_ini date;
  v_fim date;
  v_qtd numeric;
  v_horas numeric;
  v_equipe int;
  v_local text;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Permissão de Produção necessária para importar OPs';
  END IF;
  IF jsonb_typeof(p_atividades) <> 'array' OR jsonb_array_length(p_atividades) = 0 OR jsonb_array_length(p_atividades) > 200 THEN
    RAISE EXCEPTION 'Lote inválido: use de 1 a 200 atividades';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_atividades)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN RAISE EXCEPTION 'Atividade em formato inválido'; END IF;
    v_task_uid := btrim(coalesce(v_item->>'task_uid', ''));
    IF v_task_uid !~ '^[0-9]+$'
       OR btrim(coalesce(v_item->>'edt', '')) = ''
       OR btrim(coalesce(v_item->>'codigo_peca', '')) = ''
       OR btrim(coalesce(v_item->>'nome_atividade', '')) = '' THEN
      RAISE EXCEPTION 'Task UID, EDT, código da peça e nome da atividade são obrigatórios';
    END IF;

    SELECT * INTO STRICT v_projeto FROM public.producao_projetos
    WHERE id = (v_item->>'projeto_id')::uuid AND btrim(nome) = btrim(v_item->>'nome_completo_sistema');
    IF (v_projeto.id::text || ':' || v_task_uid) = ANY(v_task_uids) THEN
      RAISE EXCEPTION 'Task UID duplicado no lote para o mesmo projeto: %', v_task_uid;
    END IF;
    v_task_uids := array_append(v_task_uids, v_projeto.id::text || ':' || v_task_uid);
    -- Serializa importações concorrentes mesmo quando ainda não existe OP para FOR UPDATE.
    PERFORM pg_catalog.pg_advisory_xact_lock(hashtextextended(v_projeto.id::text || ':' || v_task_uid, 0));

    SELECT * INTO STRICT v_etapa FROM public.producao_processos
    WHERE id = (v_item->>'etapa_id')::uuid
      AND projeto_id = v_projeto.id
      AND nome = ('Etapa ' || (v_item->>'etapa'))
    FOR SHARE;
    IF v_etapa.status IN ('finalizado', 'cancelado') THEN RAISE EXCEPTION 'Etapa encerrada: %', v_etapa.id; END IF;

    SELECT * INTO STRICT v_tarefa FROM public.producao_tarefas
    WHERE id = (v_item->>'tarefa_id')::uuid
      AND ativo = true
      AND lower(btrim(nome)) = lower(btrim(v_item->>'nome_atividade'));

    v_ini := (v_item->>'inicio')::date;
    v_fim := (v_item->>'termino')::date;
    v_qtd := (v_item->>'quantidade_planejada')::numeric;
    v_horas := (v_item->>'duracao_horas')::numeric;
    v_equipe := (v_item->>'equipe_prevista')::int;
    v_local := v_item->>'local_tipo';
    IF v_ini IS NULL OR v_fim IS NULL OR v_fim < v_ini OR v_qtd <= 0 OR v_horas <= 0 OR v_equipe <= 0 OR v_local NOT IN ('Fábrica', 'Execução') THEN
      RAISE EXCEPTION 'Prazo, quantidade, duração, equipe ou local inválidos para Task UID %', v_task_uid;
    END IF;

    v_chave := 'MSP-v24 | Task UID ' || v_task_uid || ' | EDT ' || btrim(v_item->>'edt') || ' | ' || btrim(v_item->>'codigo_peca');
    SELECT * INTO v_existente FROM public.producao_ordens_producao
    WHERE projeto_id = v_projeto.id AND instrucoes LIKE v_chave || ' |%'
    FOR UPDATE;
    IF FOUND THEN
      IF v_existente.processo_id <> v_etapa.id THEN RAISE EXCEPTION 'Task UID existente vinculado a outra etapa: %', v_task_uid; END IF;
      v_mantidas := v_mantidas + 1;
      CONTINUE;
    END IF;

    -- OP correlata pode conter APs, anexos, consumo e PCP. Não associar ou duplicar.
    IF EXISTS (
      SELECT 1 FROM public.producao_ordens_producao o
      WHERE o.projeto_id = v_projeto.id AND o.status <> 'cancelada'
        AND (o.tarefa_id = v_tarefa.id OR lower(btrim(coalesce(o.tarefa_nome_snapshot, ''))) = lower(btrim(v_tarefa.nome)))
    ) THEN RAISE EXCEPTION 'OP correlata já existe; concilie antes de importar Task UID %', v_task_uid; END IF;

    -- Mantém regras, snapshots de ator, PCP e auditoria da emissão oficial de OP.
    v_nova := public.criar_ordem_producao_planejada_v1(
      v_etapa.id, v_tarefa.id, v_qtd, v_local, v_horas, v_equipe, v_ini, v_fim, NULL, NULL,
      v_chave || ' | ' || btrim(v_item->>'nome_atividade'), btrim(v_item->>'nome_atividade'), 'normal'
    );
    INSERT INTO public.producao_ordem_eventos(
      ordem_producao_id, evento, novo_status, usuario_id, nome_usuario_snapshot, dados
    ) VALUES (
      v_nova, 'op_importada_msproject_v1', 'liberada', v_user, public.nome_usuario_producao(v_user),
      jsonb_build_object(
        'fonte', 'MSP-v24', 'task_uid', v_task_uid, 'edt', v_item->>'edt', 'codigo_peca', v_item->>'codigo_peca',
        'inicio_original', v_ini, 'termino_original', v_fim, 'duracao_horas_original', v_horas,
        'quantidade_planejada_original', v_qtd, 'etapa', v_item->>'etapa'
      )
    );
    v_criadas := v_criadas + 1;
  END LOOP;
  RETURN jsonb_build_object('criadas', v_criadas, 'mantidas', v_mantidas);
END;
$$;

REVOKE ALL ON FUNCTION public.importar_ops_msproject_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_ops_msproject_v1(jsonb) TO authenticated;
COMMENT ON FUNCTION public.importar_ops_msproject_v1(jsonb) IS
  'Importa em transação OPs MSP por Task UID, sem alterar registros, histórico ou PCP existentes.';
NOTIFY pgrst, 'reload schema';

COMMIT;
