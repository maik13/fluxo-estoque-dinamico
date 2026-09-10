-- Vincula uma atividade principal à OP e preserva seu nome como snapshot.
-- O número da OP continua sendo gerado exclusivamente pela sequence do banco.

BEGIN;

ALTER TABLE public.producao_ordens_producao
  ADD COLUMN IF NOT EXISTS tarefa_id UUID NULL
    REFERENCES public.producao_tarefas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarefa_nome_snapshot TEXT NULL;

CREATE INDEX IF NOT EXISTS producao_ordens_tarefa_idx
  ON public.producao_ordens_producao(tarefa_id);

-- Backfill conservador: só infere a atividade de OPs antigas quando todos os
-- apontamentos válidos da OP usam exatamente a mesma tarefa.
WITH tarefa_unica AS (
  SELECT
    a.ordem_producao_id,
    MIN(a.tarefa_id::text)::uuid AS tarefa_id
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id IS NOT NULL
    AND a.status <> 'cancelado'
    AND a.tarefa_id IS NOT NULL
  GROUP BY a.ordem_producao_id
  HAVING COUNT(DISTINCT a.tarefa_id) = 1
)
UPDATE public.producao_ordens_producao o
SET tarefa_id = tu.tarefa_id,
    tarefa_nome_snapshot = t.nome,
    updated_at = NOW()
FROM tarefa_unica tu
JOIN public.producao_tarefas t ON t.id = tu.tarefa_id
WHERE o.id = tu.ordem_producao_id
  AND o.tarefa_id IS NULL;

CREATE OR REPLACE FUNCTION public.criar_ordem_producao_sem_limite_v3(
  p_processo_id UUID,
  p_tarefa_id UUID,
  p_quantidade_planejada NUMERIC,
  p_data_inicio_prevista DATE,
  p_data_fim_prevista DATE,
  p_local_tipo TEXT,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_equipe_prevista INTEGER DEFAULT NULL,
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
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordens de Produção';
  END IF;

  SELECT *
    INTO v_tarefa
    FROM public.producao_tarefas
   WHERE id = p_tarefa_id
     AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selecione uma atividade ativa para identificar a OP';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF p_data_inicio_prevista IS NULL
     OR p_data_fim_prevista IS NULL
     OR p_data_fim_prevista < p_data_inicio_prevista THEN
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

  SELECT *
    INTO v_processo
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

  INSERT INTO public.producao_ordens_producao (
    processo_id,
    projeto_id,
    tarefa_id,
    tarefa_nome_snapshot,
    local_tipo,
    descricao,
    instrucoes,
    produto_entregavel,
    unidade_medida,
    quantidade_planejada,
    data_inicio_prevista,
    data_fim_prevista,
    responsavel_id,
    responsavel_nome_snapshot,
    equipe_prevista,
    prioridade,
    status,
    criado_por_id,
    criado_por_nome_snapshot
  ) VALUES (
    v_processo.id,
    v_processo.projeto_id,
    v_tarefa.id,
    BTRIM(v_tarefa.nome),
    p_local_tipo,
    NULLIF(BTRIM(p_descricao), ''),
    NULLIF(BTRIM(p_instrucoes), ''),
    v_processo.produto_entregavel,
    v_processo.unidade_medida,
    p_quantidade_planejada,
    p_data_inicio_prevista,
    p_data_fim_prevista,
    p_responsavel_id,
    NULLIF(BTRIM(p_responsavel_nome), ''),
    p_equipe_prevista,
    p_prioridade,
    'liberada',
    v_user,
    v_nome
  )
  RETURNING id INTO v_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    dados
  ) VALUES (
    v_id,
    'op_emitida_com_atividade_v3',
    'liberada',
    v_user,
    v_nome,
    jsonb_build_object(
      'tarefa_id', v_tarefa.id,
      'tarefa_nome_snapshot', BTRIM(v_tarefa.nome),
      'quantidade_planejada', p_quantidade_planejada,
      'data_inicio_prevista', p_data_inicio_prevista,
      'data_fim_prevista', p_data_fim_prevista,
      'meta_etapa_referencial', v_processo.quantidade_planejada,
      'emissao_sem_limite_acumulado', TRUE,
      'versao_rpc', 3
    )
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_ordem_producao_v2(
  p_ordem_producao_id UUID,
  p_quantidade_planejada NUMERIC,
  p_data_inicio_prevista DATE,
  p_data_fim_prevista DATE,
  p_local_tipo TEXT,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_equipe_prevista INTEGER DEFAULT NULL,
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
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordens de Produção';
  END IF;

  IF BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da alteração da OP';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF p_data_inicio_prevista IS NULL
     OR p_data_fim_prevista IS NULL
     OR p_data_fim_prevista < p_data_inicio_prevista THEN
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

  SELECT *
    INTO v_op
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
    SELECT *
      INTO v_tarefa
      FROM public.producao_tarefas
     WHERE id = p_tarefa_id
       AND ativo = TRUE;

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
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa,
    dados
  ) VALUES (
    v_op.id,
    'op_editada_v2',
    v_op.status,
    v_op.status,
    v_user,
    v_nome,
    BTRIM(p_justificativa),
    jsonb_build_object(
      'valores_anteriores', v_antes,
      'valores_posteriores', v_depois,
      'quantidade_confirmada_no_momento', v_realizado,
      'versao_rpc', 2
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_ordens_producao_v2(
  p_processo_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  numero BIGINT,
  processo_id UUID,
  projeto_id UUID,
  processo_codigo TEXT,
  processo_nome TEXT,
  projeto_nome TEXT,
  projeto_cidade TEXT,
  projeto_uf TEXT,
  tarefa_id UUID,
  tarefa_nome_snapshot TEXT,
  local_tipo TEXT,
  descricao TEXT,
  instrucoes TEXT,
  produto_entregavel TEXT,
  unidade_medida TEXT,
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_realizado NUMERIC,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  responsavel_id UUID,
  responsavel_nome_snapshot TEXT,
  equipe_prevista INTEGER,
  prioridade TEXT,
  status TEXT,
  motivo_cancelamento TEXT,
  criado_por_id UUID,
  criado_por_nome_snapshot TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    o.id,
    o.numero,
    o.processo_id,
    o.projeto_id,
    p.codigo,
    p.nome,
    pr.nome,
    pr.cidade,
    pr.uf,
    o.tarefa_id,
    o.tarefa_nome_snapshot,
    o.local_tipo,
    o.descricao,
    o.instrucoes,
    o.produto_entregavel,
    o.unidade_medida,
    o.quantidade_planejada,
    COALESCE(a.realizado, 0),
    CASE
      WHEN o.quantidade_planejada > 0 THEN
        LEAST(100, ROUND((COALESCE(a.realizado, 0) / o.quantidade_planejada) * 100, 2))
      ELSE 0
    END,
    o.data_inicio_prevista,
    o.data_fim_prevista,
    o.data_inicio_real,
    o.data_fim_real,
    o.responsavel_id,
    o.responsavel_nome_snapshot,
    o.equipe_prevista,
    o.prioridade,
    o.status,
    o.motivo_cancelamento,
    o.criado_por_id,
    o.criado_por_nome_snapshot,
    o.created_at,
    o.updated_at
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id = o.processo_id
  JOIN public.producao_projetos pr ON pr.id = o.projeto_id
  LEFT JOIN (
    SELECT
      ordem_producao_id,
      SUM(COALESCE(quantidade_produzida, 0)) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido'
      AND ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ) a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND (p_processo_id IS NULL OR o.processo_id = p_processo_id)
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.numero;
$$;

REVOKE ALL ON FUNCTION public.criar_ordem_producao_sem_limite_v3(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_ordem_producao_sem_limite_v3(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION public.editar_ordem_producao_v2(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_ordem_producao_v2(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, UUID
) TO authenticated;

REVOKE ALL ON FUNCTION public.listar_ordens_producao_v2(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_ordens_producao_v2(UUID, TEXT) TO authenticated;

COMMENT ON COLUMN public.producao_ordens_producao.tarefa_id IS
  'Atividade principal que identifica nominalmente a Ordem de Produção.';
COMMENT ON COLUMN public.producao_ordens_producao.tarefa_nome_snapshot IS
  'Nome imutável da atividade no momento em que a OP recebeu sua identificação.';

NOTIFY pgrst, 'reload schema';

COMMIT;
