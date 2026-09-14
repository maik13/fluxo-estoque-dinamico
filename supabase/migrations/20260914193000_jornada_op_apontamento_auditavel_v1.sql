-- Jornada operacional da OP vinculada ao apontamento.
-- Implementação incremental: NÃO altera, reprocessa ou faz backfill das OPs/apontamentos existentes.
-- O novo fluxo passa a valer apenas quando uma jornada for iniciada após esta migration.

BEGIN;

-- Falha de forma segura antes de qualquer DDL caso o banco conectado ainda não
-- possua as dependências já utilizadas pelo módulo de Produção atual.
DO $$
BEGIN
  IF TO_REGPROCEDURE(
    'public.criar_apontamento_producao_com_horarios(date,uuid,uuid,uuid,uuid,text,numeric,time without time zone,time without time zone,integer,integer,integer,text,text,uuid[],jsonb)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: criar_apontamento_producao_com_horarios. A migration de horários individuais precisa estar instalada antes desta.';
  END IF;

  IF TO_REGPROCEDURE(
    'public.finalizar_ordem_producao_com_conferencia_v1(uuid,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Pré-requisito ausente: finalizar_ordem_producao_com_conferencia_v1. A rotina atual de finalização de OP precisa estar instalada antes desta.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.producao_op_jornadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL
    REFERENCES public.producao_ordens_producao(id) ON DELETE RESTRICT,
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  iniciado_por_id UUID NULL,
  iniciado_por_nome_snapshot TEXT NULL,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'encerrada')),
  encerrado_em TIMESTAMPTZ NULL,
  encerrado_registrado_em TIMESTAMPTZ NULL,
  encerrado_por_id UUID NULL,
  encerrado_por_nome_snapshot TEXT NULL,
  apontamento_id UUID NULL
    REFERENCES public.producao_apontamentos(id) ON DELETE SET NULL,
  fechamento_retroativo BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_regularizacao TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_op_jornada_datas_validas CHECK (
    encerrado_em IS NULL OR encerrado_em > iniciado_em
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_op_jornadas_uma_aberta_por_op
  ON public.producao_op_jornadas(ordem_producao_id)
  WHERE status = 'aberta';

CREATE INDEX IF NOT EXISTS producao_op_jornadas_op_historico_idx
  ON public.producao_op_jornadas(ordem_producao_id, iniciado_em DESC);

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS jornada_op_id UUID NULL
    REFERENCES public.producao_op_jornadas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termino_real_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS fechamento_retroativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_regularizacao TEXT NULL,
  ADD COLUMN IF NOT EXISTS regularizado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS regularizado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS regularizado_em TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS producao_apontamentos_jornada_op_unique
  ON public.producao_apontamentos(jornada_op_id)
  WHERE jornada_op_id IS NOT NULL;

ALTER TABLE public.producao_op_jornadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_op_jornadas_select ON public.producao_op_jornadas;
CREATE POLICY producao_op_jornadas_select
  ON public.producao_op_jornadas
  FOR SELECT TO authenticated
  USING (
    public.usuario_tem_permissao_producao('visualizar')
    OR public.usuario_tem_permissao_producao('lancar')
    OR public.usuario_tem_permissao_producao('processos')
  );

-- Escrita ocorre exclusivamente pelas RPCs SECURITY DEFINER abaixo.

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
  -- Iniciar trabalho é uma ação de apontamento. Usuários de configuração atuais
  -- também passam em 'lancar'; esta regra evita que um perfil legado que apenas
  -- gerencia processo abra uma jornada que depois não teria permissão para fechar.
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
    iniciado_por_nome_snapshot
  ) VALUES (
    v_op.id,
    v_iniciado_em,
    v_user,
    v_nome
  )
  RETURNING id INTO v_jornada_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, dados
  ) VALUES (
    v_op.id, 'jornada_iniciada', 'em_execucao', 'em_execucao',
    v_user, v_nome,
    jsonb_build_object('jornada_id', v_jornada_id, 'iniciado_em', v_iniciado_em)
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

CREATE OR REPLACE FUNCTION public.listar_jornadas_op_abertas_v1()
RETURNS TABLE(
  id UUID,
  ordem_producao_id UUID,
  iniciado_em TIMESTAMPTZ,
  iniciado_por_id UUID,
  iniciado_por_nome_snapshot TEXT,
  pendente_dia_anterior BOOLEAN
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
      < (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE) AS pendente_dia_anterior
  FROM public.producao_op_jornadas j
  WHERE j.status = 'aberta'
  ORDER BY j.iniciado_em;
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

  IF p_tarefa_id IS NULL THEN
    RAISE EXCEPTION 'Informe a atividade executada';
  END IF;

  IF p_termino IS NULL THEN
    RAISE EXCEPTION 'Informe o horário real de término';
  END IF;

  IF COALESCE(cardinality(p_membros), 0) = 0 THEN
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
    p_tarefa_id => p_tarefa_id,
    p_local_tipo => v_op.local_tipo,
    p_quantidade_produzida => p_quantidade_produzida,
    p_inicio => v_inicio,
    p_termino => p_termino,
    p_duracao_minutos => v_duracao,
    p_minutos_produtivos => v_duracao - v_improdutivos,
    p_minutos_improdutivos => v_improdutivos,
    p_motivo_improdutivo => NULLIF(BTRIM(p_motivo_improdutivo), ''),
    p_observacoes => NULLIF(BTRIM(p_observacoes), ''),
    p_membros => p_membros,
    p_horarios_membros => COALESCE(p_horarios_membros, '[]'::JSONB)
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

-- Evita que uma OP seja concluída/cancelada por outro fluxo enquanto existir
-- uma jornada aberta. OPs antigas sem jornada permanecem com o comportamento legado.
CREATE OR REPLACE FUNCTION public.trg_bloquear_encerramento_op_com_jornada_aberta()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('concluida', 'cancelada')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND EXISTS (
       SELECT 1
       FROM public.producao_op_jornadas j
       WHERE j.ordem_producao_id = NEW.id
         AND j.status = 'aberta'
     ) THEN
    RAISE EXCEPTION 'Existe um apontamento em aberto nesta OP. Encerre a jornada antes de concluir ou cancelar a OP';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_encerramento_op_com_jornada_aberta
  ON public.producao_ordens_producao;

CREATE TRIGGER trg_bloquear_encerramento_op_com_jornada_aberta
BEFORE UPDATE OF status
ON public.producao_ordens_producao
FOR EACH ROW
EXECUTE FUNCTION public.trg_bloquear_encerramento_op_com_jornada_aberta();

REVOKE ALL ON FUNCTION public.iniciar_jornada_op_v1(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_jornadas_op_abertas_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalizar_jornada_op_v1(UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.iniciar_jornada_op_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_jornadas_op_abertas_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_jornada_op_v1(UUID, UUID, NUMERIC, TIME, INTEGER, TEXT, TEXT, UUID[], JSONB, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.producao_op_jornadas IS
'Jornadas reais de trabalho iniciadas por clique dentro de uma OP. Não há backfill: registros históricos permanecem intactos.';
COMMENT ON COLUMN public.producao_apontamentos.fechamento_retroativo IS
'Marca apontamento encerrado em dia posterior ao dia em que a jornada foi iniciada.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Diagnóstico somente-leitura ao final da aplicação.
SELECT
  TO_REGCLASS('public.producao_op_jornadas') AS tabela_jornadas,
  TO_REGPROCEDURE('public.iniciar_jornada_op_v1(uuid)') AS rpc_iniciar,
  TO_REGPROCEDURE('public.listar_jornadas_op_abertas_v1()') AS rpc_listar_abertas,
  TO_REGPROCEDURE('public.finalizar_jornada_op_v1(uuid,uuid,numeric,time without time zone,integer,text,text,uuid[],jsonb,boolean,text,text)') AS rpc_finalizar,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bloquear_encerramento_op_com_jornada_aberta'
      AND NOT tgisinternal
  ) AS protecao_encerramento_op,
  (SELECT COUNT(*) FROM public.producao_op_jornadas) AS jornadas_existentes_pos_migration;