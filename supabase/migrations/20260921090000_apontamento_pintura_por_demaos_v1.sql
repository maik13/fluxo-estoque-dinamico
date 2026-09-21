BEGIN;

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS demao_numero INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamentos_demao_numero_positiva'
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_demao_numero_positiva
      CHECK (demao_numero IS NULL OR demao_numero > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.producao_apontamentos.demao_numero IS
'Número sequencial da demão em OPs de pintura. Nulo para atividades que não são pintura.';

WITH ranked AS (
  SELECT
    a.id,
    ROW_NUMBER() OVER (
      PARTITION BY a.ordem_producao_id
      ORDER BY a.data, a.inicio, a.created_at, a.id
    )::INTEGER AS demao
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id IS NOT NULL
    AND a.status <> 'cancelado'
    AND a.demao_numero IS NULL
    AND public.ordem_producao_e_pintura_v1(a.ordem_producao_id)
)
UPDATE public.producao_apontamentos a
SET demao_numero = r.demao
FROM ranked r
WHERE r.id = a.id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_producao_apontamentos_op_demao_ativa
  ON public.producao_apontamentos(ordem_producao_id, demao_numero)
  WHERE ordem_producao_id IS NOT NULL
    AND demao_numero IS NOT NULL
    AND status <> 'cancelado';

CREATE OR REPLACE FUNCTION public.proxima_demao_pintura_v1(
  p_ordem_producao_id UUID
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT public.ordem_producao_e_pintura_v1(p_ordem_producao_id) THEN NULL
    ELSE COALESCE((
      SELECT MAX(a.demao_numero)
      FROM public.producao_apontamentos a
      WHERE a.ordem_producao_id = p_ordem_producao_id
        AND a.status <> 'cancelado'
    ), 0) + 1
  END;
$$;

REVOKE ALL ON FUNCTION public.proxima_demao_pintura_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proxima_demao_pintura_v1(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_resumo_demaos_pintura_v1()
RETURNS TABLE(
  ordem_producao_id UUID,
  demaos_registradas INTEGER,
  ultima_demao INTEGER,
  proxima_demao INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.id,
    COUNT(a.id) FILTER (WHERE a.status <> 'cancelado' AND a.demao_numero IS NOT NULL)::INTEGER,
    COALESCE(MAX(a.demao_numero) FILTER (WHERE a.status <> 'cancelado'), 0)::INTEGER,
    (COALESCE(MAX(a.demao_numero) FILTER (WHERE a.status <> 'cancelado'), 0) + 1)::INTEGER
  FROM public.producao_ordens_producao o
  LEFT JOIN public.producao_apontamentos a
    ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND public.ordem_producao_e_pintura_v1(o.id)
  GROUP BY o.id
  ORDER BY o.numero;
$$;

REVOKE ALL ON FUNCTION public.listar_resumo_demaos_pintura_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_resumo_demaos_pintura_v1() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME WITHOUT TIME ZONE,
  p_termino TIME WITHOUT TIME ZONE,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
        AND p.status IN ('pausado','bloqueado','finalizado','cancelado')
    ) THEN
      RAISE EXCEPTION 'A Etapa da OP não está disponível para execução';
    END IF;

    v_e_pintura := public.ordem_producao_e_pintura_v1(v_op.id);

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
$$;

CREATE OR REPLACE FUNCTION public.definir_demao_apontamento_pintura_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ordem_producao_id IS NULL
     OR NOT public.ordem_producao_e_pintura_v1(NEW.ordem_producao_id) THEN
    NEW.demao_numero := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.demao_numero IS NULL THEN
    SELECT COALESCE(MAX(a.demao_numero),0) + 1
    INTO NEW.demao_numero
    FROM public.producao_apontamentos a
    WHERE a.ordem_producao_id = NEW.ordem_producao_id
      AND a.status <> 'cancelado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_definir_demao_apontamento_pintura_v1
  ON public.producao_apontamentos;
CREATE TRIGGER trg_definir_demao_apontamento_pintura_v1
BEFORE INSERT ON public.producao_apontamentos
FOR EACH ROW
EXECUTE FUNCTION public.definir_demao_apontamento_pintura_v1();

CREATE OR REPLACE FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME WITHOUT TIME ZONE,
  p_termino TIME WITHOUT TIME ZONE,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[],
  p_consumos_tinta JSONB,
  p_demao_numero INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_apontamento_id UUID;
  v_e_pintura BOOLEAN := FALSE;
  v_proxima INTEGER;
BEGIN
  IF p_consumos_tinta IS NULL OR jsonb_typeof(p_consumos_tinta) <> 'array' THEN
    RAISE EXCEPTION 'Consumos de tinta devem ser enviados em uma lista';
  END IF;

  IF p_ordem_producao_id IS NOT NULL THEN
    v_e_pintura := public.ordem_producao_e_pintura_v1(p_ordem_producao_id);
  END IF;

  IF v_e_pintura THEN
    v_proxima := public.proxima_demao_pintura_v1(p_ordem_producao_id);
    IF p_demao_numero IS NULL THEN
      RAISE EXCEPTION 'Selecione a demão deste apontamento';
    END IF;
    IF p_demao_numero <> v_proxima THEN
      RAISE EXCEPTION 'A próxima demão desta OP é a %ª demão', v_proxima;
    END IF;
    IF p_quantidade_produzida IS NULL OR p_quantidade_produzida <= 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de peças pintadas nesta demão';
    END IF;
    IF jsonb_array_length(p_consumos_tinta) = 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    END IF;
  ELSE
    p_demao_numero := NULL;
  END IF;

  v_apontamento_id := public.criar_apontamento_producao(
    p_data, p_ordem_producao_id, p_processo_id, p_projeto_local_id, p_tarefa_id,
    p_local_tipo, p_quantidade_produzida, p_inicio, p_termino, p_duracao_minutos,
    p_minutos_produtivos, p_minutos_improdutivos, p_motivo_improdutivo,
    p_observacoes, p_membros
  );

  IF v_e_pintura THEN
    UPDATE public.producao_apontamentos
    SET demao_numero = p_demao_numero
    WHERE id = v_apontamento_id;

    PERFORM public.registrar_consumos_tinta_op_v1(
      p_ordem_producao_id, v_apontamento_id, p_consumos_tinta
    );
  END IF;

  RETURN v_apontamento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao_com_consumos_tinta_v2(
  DATE, UUID, UUID, UUID, UUID, TEXT, NUMERIC, TIME WITHOUT TIME ZONE,
  TIME WITHOUT TIME ZONE, INTEGER, INTEGER, INTEGER, TEXT, TEXT, UUID[], JSONB, INTEGER
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalizar_jornada_op_com_consumos_v2(
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
  p_consumos_tinta JSONB,
  p_demao_numero INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ordem_producao_id UUID;
  v_resultado JSONB;
  v_apontamento_id UUID;
  v_finalizacao JSONB := NULL;
  v_consumo_resultado JSONB := NULL;
  v_e_pintura BOOLEAN := FALSE;
  v_proxima INTEGER;
BEGIN
  SELECT ordem_producao_id INTO v_ordem_producao_id
  FROM public.producao_op_jornadas
  WHERE id = p_jornada_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Jornada da OP não encontrada'; END IF;

  v_e_pintura := public.ordem_producao_e_pintura_v1(v_ordem_producao_id);

  IF v_e_pintura THEN
    v_proxima := public.proxima_demao_pintura_v1(v_ordem_producao_id);
    IF p_demao_numero IS NULL THEN
      RAISE EXCEPTION 'Selecione a demão deste apontamento';
    END IF;
    IF p_demao_numero <> v_proxima THEN
      RAISE EXCEPTION 'A próxima demão desta OP é a %ª demão', v_proxima;
    END IF;
    IF p_quantidade_produzida IS NULL OR p_quantidade_produzida <= 0 THEN
      RAISE EXCEPTION 'Informe a quantidade de peças pintadas nesta demão';
    END IF;
    IF p_consumos_tinta IS NULL
       OR jsonb_typeof(p_consumos_tinta) <> 'array'
       OR jsonb_array_length(p_consumos_tinta) = 0 THEN
      RAISE EXCEPTION 'O valor de tinta unitário por peça é obrigatório nas OPs de pintura';
    END IF;
  END IF;

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
    p_concluir_op => FALSE,
    p_motivo_regularizacao => p_motivo_regularizacao,
    p_justificativa_conclusao => p_justificativa_conclusao
  );

  v_apontamento_id := (v_resultado ->> 'apontamento_id')::UUID;

  IF v_e_pintura THEN
    UPDATE public.producao_apontamentos
    SET demao_numero = p_demao_numero
    WHERE id = v_apontamento_id;

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
    'demao_numero', CASE WHEN v_e_pintura THEN p_demao_numero ELSE NULL END,
    'op_concluida', p_concluir_op,
    'finalizacao', v_finalizacao,
    'consumo_tinta', v_consumo_resultado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_jornada_op_com_consumos_v2(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_com_consumos_v2(
  UUID, UUID, NUMERIC, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT,
  UUID[], JSONB, BOOLEAN, TEXT, TEXT, JSONB, INTEGER
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.listar_ordens_producao_v2(
  p_processo_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID, numero BIGINT, processo_id UUID, projeto_id UUID, processo_codigo TEXT,
  processo_nome TEXT, projeto_nome TEXT, projeto_cidade TEXT, projeto_uf TEXT,
  tarefa_id UUID, tarefa_nome_snapshot TEXT, local_tipo TEXT, descricao TEXT,
  instrucoes TEXT, produto_entregavel TEXT, unidade_medida TEXT,
  quantidade_planejada NUMERIC, quantidade_realizada NUMERIC,
  percentual_realizado NUMERIC, data_inicio_prevista DATE, data_fim_prevista DATE,
  data_inicio_real DATE, data_fim_real DATE, responsavel_id UUID,
  responsavel_nome_snapshot TEXT, equipe_prevista INTEGER, prioridade TEXT,
  status TEXT, motivo_cancelamento TEXT, criado_por_id UUID,
  criado_por_nome_snapshot TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.id, o.numero, o.processo_id, o.projeto_id, p.codigo, p.nome, pr.nome,
    pr.cidade, pr.uf, o.tarefa_id, o.tarefa_nome_snapshot, o.local_tipo,
    o.descricao, o.instrucoes, o.produto_entregavel, o.unidade_medida,
    o.quantidade_planejada,
    CASE
      WHEN public.ordem_producao_e_pintura_v1(o.id) THEN COALESCE(a.maior_demao, 0)
      ELSE COALESCE(a.soma_apontada, 0)
    END,
    CASE
      WHEN o.quantidade_planejada > 0 THEN
        LEAST(
          100,
          ROUND((
            CASE
              WHEN public.ordem_producao_e_pintura_v1(o.id) THEN COALESCE(a.maior_demao, 0)
              ELSE COALESCE(a.soma_apontada, 0)
            END / o.quantidade_planejada
          ) * 100, 2)
        )
      ELSE 0
    END,
    o.data_inicio_prevista, o.data_fim_prevista, o.data_inicio_real, o.data_fim_real,
    o.responsavel_id, o.responsavel_nome_snapshot, o.equipe_prevista, o.prioridade,
    o.status, o.motivo_cancelamento, o.criado_por_id, o.criado_por_nome_snapshot,
    o.created_at, o.updated_at
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id = o.processo_id
  JOIN public.producao_projetos pr ON pr.id = o.projeto_id
  LEFT JOIN (
    SELECT
      ordem_producao_id,
      SUM(COALESCE(quantidade_produzida, 0))
        FILTER (WHERE status <> 'cancelado') AS soma_apontada,
      MAX(COALESCE(quantidade_produzida, 0))
        FILTER (WHERE status <> 'cancelado') AS maior_demao
    FROM public.producao_apontamentos
    WHERE ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ) a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND (p_processo_id IS NULL OR o.processo_id = p_processo_id)
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.numero;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  p_ordem_producao_id UUID,
  p_justificativa TEXT DEFAULT NULL
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
  v_pendentes_conferidos INTEGER := 0;
  v_apontamentos_validos INTEGER := 0;
  v_realizado NUMERIC := 0;
  v_demaos INTEGER := 0;
  v_e_pintura BOOLEAN := FALSE;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para finalizar Ordens de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de Produção não encontrada'; END IF;
  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'A OP não está aberta para finalização';
  END IF;

  v_e_pintura := public.ordem_producao_e_pintura_v1(v_op.id);

  IF v_e_pintura AND NOT EXISTS (
    SELECT 1 FROM public.producao_consumos_tinta c
    WHERE c.ordem_producao_id = v_op.id AND c.quantidade_ml > 0
  ) THEN
    RAISE EXCEPTION 'Informe o consumo de tinta antes de concluir esta OP de pintura.';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, campo_alterado, valor_anterior, valor_novo,
    usuario_id, nome_usuario_snapshot, justificativa
  )
  SELECT
    a.id, 'apontamento_conferido_ao_finalizar_op', 'status', a.status, 'conferido',
    v_user, v_nome, 'Conferência automática realizada na finalização da OP'
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id AND a.status = 'lancado';

  UPDATE public.producao_apontamentos
  SET status = 'conferido',
      conferido_por_id = v_user,
      conferido_por_nome_snapshot = v_nome,
      conferido_em = NOW(),
      updated_at = NOW()
  WHERE ordem_producao_id = v_op.id AND status = 'lancado';

  GET DIAGNOSTICS v_pendentes_conferidos = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE a.status <> 'cancelado'),
    CASE
      WHEN v_e_pintura THEN COALESCE(MAX(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0)
      ELSE COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0)
    END,
    COUNT(DISTINCT a.demao_numero)
      FILTER (WHERE a.status = 'conferido' AND a.demao_numero IS NOT NULL)
  INTO v_apontamentos_validos, v_realizado, v_demaos
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id;

  IF v_apontamentos_validos = 0 THEN
    RAISE EXCEPTION 'A OP não possui apontamentos válidos para finalização';
  END IF;

  IF v_realizado < v_op.quantidade_planejada
     AND BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION
      'JUSTIFICATIVA_PARCIAL: A produção confirmada (%) é menor que a quantidade planejada (%). Informe o motivo para finalizar a OP com saldo parcial',
      v_realizado, v_op.quantidade_planejada;
  END IF;

  UPDATE public.producao_ordens_producao
  SET status = 'concluida',
      data_inicio_real = COALESCE(data_inicio_real, CURRENT_DATE),
      data_fim_real = CURRENT_DATE,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = NOW()
  WHERE id = v_op.id;

  UPDATE public.producao_processos
  SET status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
      data_inicio_real = CASE WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE) ELSE data_inicio_real END,
      updated_at = NOW()
  WHERE id = v_op.processo_id AND status = 'planejado';

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa, dados
  ) VALUES (
    v_op.id, 'op_finalizada_com_conferencia', v_op.status, 'concluida',
    v_user, v_nome, NULLIF(BTRIM(p_justificativa), ''),
    jsonb_build_object(
      'apontamentos_conferidos_automaticamente', v_pendentes_conferidos,
      'apontamentos_validos', v_apontamentos_validos,
      'quantidade_planejada', v_op.quantidade_planejada,
      'quantidade_confirmada', v_realizado,
      'demaos_registradas', CASE WHEN v_e_pintura THEN v_demaos ELSE NULL END,
      'versao_rpc', 2
    )
  );

  RETURN jsonb_build_object(
    'ordem_producao_id', v_op.id,
    'apontamentos_conferidos', v_pendentes_conferidos,
    'apontamentos_validos', v_apontamentos_validos,
    'quantidade_planejada', v_op.quantidade_planejada,
    'quantidade_confirmada', v_realizado,
    'demaos_registradas', CASE WHEN v_e_pintura THEN v_demaos ELSE NULL END,
    'status', 'concluida'
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
