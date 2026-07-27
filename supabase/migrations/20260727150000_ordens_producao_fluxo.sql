-- Ordens de Produção como entidade própria entre Etapas e Apontamentos.
-- Fluxo: Projeto -> Etapa -> OP -> Apontamentos.

BEGIN;

-- Remove a modelagem experimental que numerava cada apontamento como se fosse uma OP.
ALTER TABLE public.producao_apontamentos DROP COLUMN IF EXISTS numero_op CASCADE;
DROP SEQUENCE IF EXISTS public.producao_apontamento_op_seq;

CREATE SEQUENCE IF NOT EXISTS public.producao_ordem_numero_seq
  AS BIGINT START WITH 1 INCREMENT BY 1 MINVALUE 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS public.producao_ordens_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('public.producao_ordem_numero_seq'),
  processo_id UUID NOT NULL REFERENCES public.producao_processos(id) ON DELETE RESTRICT,
  projeto_id UUID NOT NULL REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  local_tipo TEXT NOT NULL CHECK (local_tipo IN ('Fábrica', 'Execução')),
  descricao TEXT NULL,
  instrucoes TEXT NULL,
  produto_entregavel TEXT NULL,
  unidade_medida TEXT NULL,
  quantidade_planejada NUMERIC(14,3) NOT NULL CHECK (quantidade_planejada > 0),
  data_inicio_prevista DATE NOT NULL,
  data_fim_prevista DATE NOT NULL,
  data_inicio_real DATE NULL,
  data_fim_real DATE NULL,
  responsavel_id UUID NULL,
  responsavel_nome_snapshot TEXT NULL,
  equipe_prevista INTEGER NULL CHECK (equipe_prevista IS NULL OR equipe_prevista >= 0),
  prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  status TEXT NOT NULL DEFAULT 'liberada' CHECK (status IN ('rascunho','liberada','em_execucao','concluida','cancelada')),
  motivo_cancelamento TEXT NULL,
  criado_por_id UUID NULL,
  criado_por_nome_snapshot TEXT NULL,
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT producao_ordem_datas_validas CHECK (data_fim_prevista >= data_inicio_prevista)
);

ALTER SEQUENCE public.producao_ordem_numero_seq
  OWNED BY public.producao_ordens_producao.numero;

CREATE UNIQUE INDEX IF NOT EXISTS producao_ordens_numero_unique
  ON public.producao_ordens_producao(numero);
CREATE INDEX IF NOT EXISTS producao_ordens_processo_idx
  ON public.producao_ordens_producao(processo_id, status, numero);
CREATE INDEX IF NOT EXISTS producao_ordens_projeto_idx
  ON public.producao_ordens_producao(projeto_id, status);

CREATE TABLE IF NOT EXISTS public.producao_ordem_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL REFERENCES public.producao_ordens_producao(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  status_anterior TEXT NULL,
  novo_status TEXT NULL,
  usuario_id UUID NULL,
  nome_usuario_snapshot TEXT NULL,
  justificativa TEXT NULL,
  dados JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS producao_ordem_eventos_ordem_idx
  ON public.producao_ordem_eventos(ordem_producao_id, created_at);

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS ordem_producao_id UUID NULL
  REFERENCES public.producao_ordens_producao(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS producao_apontamentos_ordem_idx
  ON public.producao_apontamentos(ordem_producao_id, data, status);

ALTER TABLE public.producao_ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_ordem_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_ordens_leitura_atual ON public.producao_ordens_producao;
CREATE POLICY producao_ordens_leitura_atual
  ON public.producao_ordens_producao FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

DROP POLICY IF EXISTS producao_ordem_eventos_leitura_atual ON public.producao_ordem_eventos;
CREATE POLICY producao_ordem_eventos_leitura_atual
  ON public.producao_ordem_eventos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('auditoria'));

CREATE OR REPLACE FUNCTION public.nome_usuario_producao(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(BTRIM(p.nome), '') FROM public.profiles p WHERE p.user_id = p_user_id LIMIT 1),
    (SELECT NULLIF(BTRIM(u.raw_user_meta_data->>'name'), '') FROM auth.users u WHERE u.id = p_user_id),
    (SELECT u.email FROM auth.users u WHERE u.id = p_user_id),
    'Usuário'
  );
$$;

CREATE OR REPLACE FUNCTION public.criar_ordem_producao(
  p_processo_id UUID,
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_processo public.producao_processos%ROWTYPE;
  v_id UUID;
  v_alocado NUMERIC;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordens de Produção';
  END IF;
  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;
  IF p_data_inicio_prevista IS NULL OR p_data_fim_prevista IS NULL OR p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'Informe um período planejado válido para a OP';
  END IF;
  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;
  IF p_prioridade NOT IN ('baixa','normal','alta','urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;
  IF p_equipe_prevista IS NOT NULL AND p_equipe_prevista < 0 THEN
    RAISE EXCEPTION 'Equipe prevista inválida';
  END IF;

  SELECT * INTO v_processo
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
  IF v_processo.status IN ('finalizado','cancelado') THEN
    RAISE EXCEPTION 'Não é possível emitir OP para uma etapa encerrada';
  END IF;

  SELECT COALESCE(SUM(o.quantidade_planejada), 0)
  INTO v_alocado
  FROM public.producao_ordens_producao o
  WHERE o.processo_id = p_processo_id
    AND o.status <> 'cancelada';

  IF COALESCE(v_processo.quantidade_planejada, 0) > 0
     AND v_alocado + p_quantidade_planejada > v_processo.quantidade_planejada THEN
    RAISE EXCEPTION 'A quantidade das OPs ultrapassa a quantidade planejada da etapa. Saldo disponível: %',
      GREATEST(v_processo.quantidade_planejada - v_alocado, 0);
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_ordens_producao (
    processo_id, projeto_id, local_tipo, descricao, instrucoes,
    produto_entregavel, unidade_medida, quantidade_planejada,
    data_inicio_prevista, data_fim_prevista, responsavel_id,
    responsavel_nome_snapshot, equipe_prevista, prioridade, status,
    criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    v_processo.id, v_processo.projeto_id, p_local_tipo,
    NULLIF(BTRIM(p_descricao), ''), NULLIF(BTRIM(p_instrucoes), ''),
    v_processo.produto_entregavel, v_processo.unidade_medida,
    p_quantidade_planejada, p_data_inicio_prevista, p_data_fim_prevista,
    p_responsavel_id, NULLIF(BTRIM(p_responsavel_nome), ''),
    p_equipe_prevista, p_prioridade, 'liberada', v_user, v_nome
  ) RETURNING id INTO v_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, novo_status, usuario_id,
    nome_usuario_snapshot, dados
  ) VALUES (
    v_id, 'op_emitida', 'liberada', v_user, v_nome,
    jsonb_build_object('quantidade_planejada', p_quantidade_planejada,
      'data_inicio_prevista', p_data_inicio_prevista,
      'data_fim_prevista', p_data_fim_prevista)
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.transicao_ordem_producao(
  p_ordem_producao_id UUID,
  p_acao TEXT,
  p_justificativa TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_novo TEXT;
  v_pendentes INTEGER;
  v_ativos INTEGER;
  v_realizado NUMERIC;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar Ordens de Produção';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de Produção não encontrada'; END IF;

  SELECT
    COUNT(*) FILTER (WHERE a.status = 'lancado'),
    COUNT(*) FILTER (WHERE a.status <> 'cancelado'),
    COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0)
  INTO v_pendentes, v_ativos, v_realizado
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id;

  CASE p_acao
    WHEN 'iniciar' THEN
      IF v_op.status <> 'liberada' THEN RAISE EXCEPTION 'Somente uma OP liberada pode ser iniciada'; END IF;
      v_novo := 'em_execucao';
    WHEN 'concluir' THEN
      IF v_op.status NOT IN ('liberada','em_execucao') THEN RAISE EXCEPTION 'A OP não está aberta para conclusão'; END IF;
      IF v_pendentes > 0 THEN RAISE EXCEPTION 'Existem apontamentos pendentes de conferência nesta OP'; END IF;
      IF v_ativos = 0 THEN RAISE EXCEPTION 'A OP não possui apontamentos válidos'; END IF;
      IF v_realizado < v_op.quantidade_planejada AND BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A quantidade realizada é menor que a planejada. Informe uma justificativa';
      END IF;
      v_novo := 'concluida';
    WHEN 'cancelar' THEN
      IF v_op.status IN ('concluida','cancelada') THEN RAISE EXCEPTION 'A OP já está encerrada'; END IF;
      IF BTRIM(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'A justificativa é obrigatória'; END IF;
      IF v_ativos > 0 THEN RAISE EXCEPTION 'Cancele os apontamentos da OP antes de cancelá-la'; END IF;
      v_novo := 'cancelada';
    WHEN 'reabrir' THEN
      IF v_op.status NOT IN ('concluida','cancelada') THEN RAISE EXCEPTION 'Somente uma OP encerrada pode ser reaberta'; END IF;
      IF BTRIM(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'A justificativa é obrigatória'; END IF;
      v_novo := CASE WHEN v_ativos > 0 THEN 'em_execucao' ELSE 'liberada' END;
    ELSE
      RAISE EXCEPTION 'Ação de OP desconhecida';
  END CASE;

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao SET
    status = v_novo,
    data_inicio_real = CASE WHEN p_acao = 'iniciar' THEN COALESCE(data_inicio_real, CURRENT_DATE) ELSE data_inicio_real END,
    data_fim_real = CASE WHEN p_acao = 'concluir' THEN CURRENT_DATE WHEN p_acao = 'reabrir' THEN NULL ELSE data_fim_real END,
    motivo_cancelamento = CASE WHEN p_acao = 'cancelar' THEN BTRIM(p_justificativa) WHEN p_acao = 'reabrir' THEN NULL ELSE motivo_cancelamento END,
    atualizado_por_id = v_user,
    atualizado_por_nome_snapshot = v_nome,
    updated_at = NOW()
  WHERE id = v_op.id;

  IF p_acao = 'iniciar' THEN
    UPDATE public.producao_processos SET
      status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
      data_inicio_real = CASE WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE) ELSE data_inicio_real END,
      updated_at = NOW()
    WHERE id = v_op.processo_id AND status = 'planejado';
  END IF;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id, evento, status_anterior, novo_status,
    usuario_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    v_op.id, p_acao, v_op.status, v_novo,
    v_user, v_nome, NULLIF(BTRIM(p_justificativa), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_ordem_producao(p_ordem_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_op public.producao_ordens_producao%ROWTYPE;
  v_ativos INTEGER;
  v_pendentes INTEGER;
  v_realizado NUMERIC;
  v_primeira DATE;
  v_ultima DATE;
BEGIN
  IF p_ordem_id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_op FROM public.producao_ordens_producao WHERE id = p_ordem_id FOR UPDATE;
  IF NOT FOUND OR v_op.status IN ('cancelada','concluida') THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelado'),
    COUNT(*) FILTER (WHERE status = 'lancado'),
    COALESCE(SUM(quantidade_produzida) FILTER (WHERE status = 'conferido'), 0),
    MIN(data) FILTER (WHERE status <> 'cancelado'),
    MAX(data) FILTER (WHERE status = 'conferido')
  INTO v_ativos, v_pendentes, v_realizado, v_primeira, v_ultima
  FROM public.producao_apontamentos
  WHERE ordem_producao_id = p_ordem_id;

  UPDATE public.producao_ordens_producao SET
    status = CASE
      WHEN v_realizado >= quantidade_planejada AND v_pendentes = 0 THEN 'concluida'
      WHEN v_ativos > 0 THEN 'em_execucao'
      ELSE 'liberada'
    END,
    data_inicio_real = CASE WHEN v_ativos > 0 THEN COALESCE(data_inicio_real, v_primeira) ELSE data_inicio_real END,
    data_fim_real = CASE WHEN v_realizado >= quantidade_planejada AND v_pendentes = 0 THEN COALESCE(v_ultima, CURRENT_DATE) ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_ordem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_atualizar_status_ordem_producao()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.ordem_producao_id IS DISTINCT FROM NEW.ordem_producao_id THEN
    PERFORM public.atualizar_status_ordem_producao(OLD.ordem_producao_id);
  END IF;
  PERFORM public.atualizar_status_ordem_producao(COALESCE(NEW.ordem_producao_id, OLD.ordem_producao_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_apontamento_atualiza_ordem ON public.producao_apontamentos;
CREATE TRIGGER trg_apontamento_atualiza_ordem
AFTER INSERT OR UPDATE OF status, quantidade_produzida, ordem_producao_id OR DELETE
ON public.producao_apontamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_atualizar_status_ordem_producao();

CREATE OR REPLACE FUNCTION public.listar_ordens_producao(
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
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT
    o.id, o.numero, o.processo_id, o.projeto_id,
    p.codigo, p.nome, pr.nome, pr.cidade, pr.uf,
    o.local_tipo, o.descricao, o.instrucoes,
    o.produto_entregavel, o.unidade_medida, o.quantidade_planejada,
    COALESCE(a.realizado, 0),
    CASE WHEN o.quantidade_planejada > 0
      THEN LEAST(100, ROUND((COALESCE(a.realizado,0) / o.quantidade_planejada) * 100, 2))
      ELSE 0 END,
    o.data_inicio_prevista, o.data_fim_prevista,
    o.data_inicio_real, o.data_fim_real,
    o.responsavel_id, o.responsavel_nome_snapshot,
    o.equipe_prevista, o.prioridade, o.status,
    o.motivo_cancelamento, o.criado_por_id,
    o.criado_por_nome_snapshot, o.created_at, o.updated_at
  FROM public.producao_ordens_producao o
  JOIN public.producao_processos p ON p.id = o.processo_id
  JOIN public.producao_projetos pr ON pr.id = o.projeto_id
  LEFT JOIN (
    SELECT ordem_producao_id, SUM(COALESCE(quantidade_produzida,0)) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND ordem_producao_id IS NOT NULL
    GROUP BY ordem_producao_id
  ) a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND (p_processo_id IS NULL OR o.processo_id = p_processo_id)
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.numero;
$$;

-- Nova assinatura: todo apontamento planejado nasce dentro de uma OP.
CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(
  p_data DATE,
  p_ordem_producao_id UUID,
  p_processo_id UUID,
  p_projeto_local_id UUID,
  p_tarefa_id UUID,
  p_local_tipo TEXT,
  p_quantidade_produzida NUMERIC,
  p_inicio TIME,
  p_termino TIME,
  p_duracao_minutos INTEGER,
  p_minutos_produtivos INTEGER,
  p_minutos_improdutivos INTEGER,
  p_motivo_improdutivo TEXT,
  p_observacoes TEXT,
  p_membros UUID[]
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para lançar apontamentos';
  END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Data obrigatória'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF COALESCE(p_minutos_produtivos,0) + COALESCE(p_minutos_improdutivos,0) <> p_duracao_minutos THEN
    RAISE EXCEPTION 'A soma dos tempos deve ser igual à duração';
  END IF;
  IF COALESCE(p_minutos_improdutivos,0) > 0 AND BTRIM(COALESCE(p_motivo_improdutivo,'')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;
  IF COALESCE(CARDINALITY(p_membros),0) = 0 THEN RAISE EXCEPTION 'Informe ao menos um membro'; END IF;

  IF p_ordem_producao_id IS NOT NULL THEN
    SELECT * INTO v_op FROM public.producao_ordens_producao WHERE id = p_ordem_producao_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ordem de Produção não encontrada'; END IF;
    IF v_op.status NOT IN ('liberada','em_execucao') THEN RAISE EXCEPTION 'A OP não está liberada para apontamentos'; END IF;
    IF EXISTS (SELECT 1 FROM public.producao_processos WHERE id = v_op.processo_id AND status IN ('pausado','bloqueado','finalizado','cancelado')) THEN
      RAISE EXCEPTION 'A etapa da OP não está disponível para execução';
    END IF;
    v_processo_id := v_op.processo_id;
    v_projeto_local_id := NULL;
    v_local_tipo := v_op.local_tipo;

    UPDATE public.producao_processos SET
      status = CASE WHEN status = 'planejado' THEN 'em_andamento' ELSE status END,
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
    data, ordem_producao_id, processo_id, projeto_local_id,
    tarefa_id, local_tipo, quantidade_produzida, inicio, termino,
    duracao_minutos, minutos_produtivos, minutos_improdutivos,
    motivo_improdutivo, observacoes, criado_por_id,
    criado_por_nome_snapshot
  ) VALUES (
    p_data, p_ordem_producao_id, v_processo_id, v_projeto_local_id,
    p_tarefa_id, v_local_tipo, p_quantidade_produzida, p_inicio, p_termino,
    p_duracao_minutos, p_minutos_produtivos, p_minutos_improdutivos,
    NULLIF(BTRIM(p_motivo_improdutivo),''), NULLIF(BTRIM(p_observacoes),''),
    v_user, v_nome
  ) RETURNING id INTO v_id;

  FOR v_membro IN
    SELECT m.id, m.nome, m.valor_hora, m.jornada_diaria_minutos
    FROM public.producao_membros m
    WHERE m.id = ANY(p_membros) AND m.ativo = TRUE
  LOOP
    INSERT INTO public.producao_apontamento_membros (
      apontamento_id, membro_id, nome_snapshot, valor_hora_snapshot,
      jornada_diaria_minutos_snapshot, minutos_produtivos_snapshot,
      minutos_improdutivos_snapshot
    ) VALUES (
      v_id, v_membro.id, v_membro.nome, v_membro.valor_hora,
      v_membro.jornada_diaria_minutos, p_minutos_produtivos,
      p_minutos_improdutivos
    );
  END LOOP;

  IF (SELECT COUNT(*) FROM public.producao_apontamento_membros WHERE apontamento_id = v_id) <> CARDINALITY(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  ) VALUES (
    v_id, 'criacao', v_user, v_nome,
    jsonb_build_object('ordem_producao_id', p_ordem_producao_id,
      'processo_id', v_processo_id, 'projeto_local_id', v_projeto_local_id)::TEXT
  );

  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.listar_gantt_producao();
CREATE FUNCTION public.listar_gantt_producao()
RETURNS TABLE (
  etapa_id UUID,
  codigo TEXT,
  etapa_nome TEXT,
  projeto_id UUID,
  projeto_nome TEXT,
  cidade TEXT,
  uf TEXT,
  grupo_cronograma TEXT,
  sequencia INTEGER,
  unidade_medida TEXT,
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_realizado NUMERIC,
  status TEXT,
  prioridade TEXT,
  data_inicio_desejada DATE,
  data_limite DATE,
  data_inicio_prevista DATE,
  data_fim_prevista DATE,
  data_inicio_real DATE,
  data_fim_real DATE,
  capacidade_diaria NUMERIC,
  pessoas_necessarias NUMERIC,
  alocacoes JSONB,
  ordens JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT
    p.id, p.codigo, p.nome, p.projeto_id, pr.nome, pr.cidade, pr.uf,
    p.grupo_cronograma, p.sequencia, p.unidade_medida, p.quantidade_planejada,
    COALESCE(r.realizado, 0),
    CASE WHEN COALESCE(p.quantidade_planejada, 0) <= 0 THEN 0
      ELSE LEAST(100, ROUND((COALESCE(r.realizado, 0) / p.quantidade_planejada) * 100, 2)) END,
    p.status, p.prioridade, p.data_inicio_desejada, p.data_limite,
    p.data_inicio_prevista, p.data_fim_prevista, p.data_inicio_real, p.data_fim_real,
    p.capacidade_diaria, p.pessoas_necessarias,
    COALESCE(al.alocacoes, '[]'::jsonb),
    COALESCE(ops.ordens, '[]'::jsonb)
  FROM public.producao_processos p
  JOIN public.producao_projetos pr ON pr.id = p.projeto_id
  LEFT JOIN (
    SELECT processo_id, COALESCE(SUM(quantidade_produzida),0) AS realizado
    FROM public.producao_apontamentos
    WHERE status = 'conferido' AND processo_id IS NOT NULL
    GROUP BY processo_id
  ) r ON r.processo_id = p.id
  LEFT JOIN (
    SELECT processo_id, jsonb_agg(jsonb_build_object(
      'data', data,
      'quantidade_planejada', quantidade_planejada,
      'pessoas_planejadas', pessoas_planejadas
    ) ORDER BY data) AS alocacoes
    FROM public.producao_alocacoes_diarias GROUP BY processo_id
  ) al ON al.processo_id = p.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'id', x.id,
      'numero', x.numero,
      'status', x.status,
      'local_tipo', x.local_tipo,
      'quantidade_planejada', x.quantidade_planejada,
      'quantidade_realizada', x.quantidade_realizada,
      'percentual_realizado', x.percentual_realizado,
      'data_inicio_prevista', x.data_inicio_prevista,
      'data_fim_prevista', x.data_fim_prevista,
      'data_inicio_real', x.data_inicio_real,
      'data_fim_real', x.data_fim_real,
      'responsavel_nome', x.responsavel_nome_snapshot
    ) ORDER BY x.numero) AS ordens
    FROM (
      SELECT o.*,
        COALESCE(ap.realizado,0) AS quantidade_realizada,
        CASE WHEN o.quantidade_planejada > 0
          THEN LEAST(100, ROUND((COALESCE(ap.realizado,0) / o.quantidade_planejada) * 100,2))
          ELSE 0 END AS percentual_realizado
      FROM public.producao_ordens_producao o
      LEFT JOIN (
        SELECT ordem_producao_id, SUM(COALESCE(quantidade_produzida,0)) AS realizado
        FROM public.producao_apontamentos
        WHERE status = 'conferido' AND ordem_producao_id IS NOT NULL
        GROUP BY ordem_producao_id
      ) ap ON ap.ordem_producao_id = o.id
      WHERE o.processo_id = p.id
    ) x
  ) ops ON TRUE
  WHERE public.usuario_tem_permissao_producao('visualizar')
  ORDER BY pr.nome, p.sequencia, p.created_at;
$$;

REVOKE ALL ON FUNCTION public.nome_usuario_producao(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_ordem_producao(UUID,NUMERIC,DATE,DATE,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transicao_ordem_producao(UUID,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atualizar_status_ordem_producao(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_ordens_producao(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_apontamento_producao(DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_gantt_producao() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_ordem_producao(UUID,NUMERIC,DATE,DATE,TEXT,UUID,TEXT,INTEGER,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transicao_ordem_producao(UUID,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_ordens_producao(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_apontamento_producao(DATE,UUID,UUID,UUID,UUID,TEXT,NUMERIC,TIME,TIME,INTEGER,INTEGER,INTEGER,TEXT,TEXT,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_gantt_producao() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
