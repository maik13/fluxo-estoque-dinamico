-- Recuperação idempotente das funções-base ausentes do Módulo de Produção.
-- Pode ser aplicada após 20260725140000_integridade_gravacoes_producao.sql.
-- Não apaga projetos, etapas, apontamentos ou configurações existentes.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Compatibilidade mínima de schema
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'producao_membro_origem') THEN
    CREATE TYPE public.producao_membro_origem AS ENUM ('solicitante', 'producao', 'legado_pendente');
  END IF;
END $$;

ALTER TABLE public.producao_membros
  ADD COLUMN IF NOT EXISTS nome TEXT NULL,
  ADD COLUMN IF NOT EXISTS apelido TEXT NULL,
  ADD COLUMN IF NOT EXISTS funcao TEXT NULL,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS valor_hora NUMERIC(12,2) NULL,
  ADD COLUMN IF NOT EXISTS nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS origem public.producao_membro_origem NULL;

UPDATE public.producao_membros
SET nome = COALESCE(NULLIF(BTRIM(nome), ''), NULLIF(BTRIM(nome_snapshot), ''), 'Membro sem nome'),
    nome_snapshot = COALESCE(NULLIF(BTRIM(nome_snapshot), ''), NULLIF(BTRIM(nome), ''), 'Membro sem nome'),
    origem = COALESCE(origem, 'producao'::public.producao_membro_origem)
WHERE nome IS NULL OR BTRIM(nome) = ''
   OR nome_snapshot IS NULL OR BTRIM(nome_snapshot) = ''
   OR origem IS NULL;

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS processo_id UUID NULL,
  ADD COLUMN IF NOT EXISTS minutos_produtivos INTEGER NULL,
  ADD COLUMN IF NOT EXISTS minutos_improdutivos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS motivo_improdutivo TEXT NULL,
  ADD COLUMN IF NOT EXISTS criado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS conferido_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT NULL;

ALTER TABLE public.producao_apontamentos
  ALTER COLUMN projeto_local_id DROP NOT NULL;

UPDATE public.producao_apontamentos
SET minutos_produtivos = GREATEST(COALESCE(duracao_minutos, 0) - COALESCE(minutos_improdutivos, 0), 0)
WHERE minutos_produtivos IS NULL;

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS membro_id UUID NULL,
  ADD COLUMN IF NOT EXISTS nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS valor_hora_snapshot NUMERIC(12,2) NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_apontamento_membros'
      AND column_name = 'solicitante_id'
  ) THEN
    ALTER TABLE public.producao_apontamento_membros
      ALTER COLUMN solicitante_id DROP NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS producao_apontamento_membros_apontamento_membro_unique
  ON public.producao_apontamento_membros(apontamento_id, membro_id)
  WHERE membro_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.producao_apontamento_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id UUID NOT NULL REFERENCES public.producao_apontamentos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes BIGINT NULL CHECK (size_bytes IS NULL OR size_bytes > 0),
  uploaded_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS producao_apontamento_anexos_apontamento_id_idx
  ON public.producao_apontamento_anexos(apontamento_id);

ALTER TABLE public.producao_apontamento_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS producao_apontamento_anexos_leitura_atual
  ON public.producao_apontamento_anexos;
CREATE POLICY producao_apontamento_anexos_leitura_atual
  ON public.producao_apontamento_anexos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'producao-apontamentos',
  'producao-apontamentos',
  FALSE,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Código automático da etapa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_proximo_codigo_etapa_producao()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_last BIGINT;
  v_is_called BOOLEAN;
  v_proximo BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT last_value, is_called
  INTO v_last, v_is_called
  FROM public.producao_processo_codigo_seq;

  v_proximo := CASE WHEN v_is_called THEN v_last + 1 ELSE v_last END;

  RETURN 'PRD-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_proximo::TEXT, 6, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Transições de etapa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transicao_processo_producao(
  p_processo_id UUID,
  p_acao TEXT,
  p_justificativa TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v public.producao_processos%ROWTYPE;
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_novo TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  IF p_acao = 'finalizar' AND NOT public.usuario_tem_permissao_producao('finalizar') THEN
    RAISE EXCEPTION 'Sem permissão para finalizar a etapa';
  ELSIF p_acao = 'reabrir' AND NOT public.usuario_tem_permissao_producao('reabrir') THEN
    RAISE EXCEPTION 'Sem permissão para reabrir a etapa';
  ELSIF p_acao NOT IN ('finalizar','reabrir') AND NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para alterar a etapa';
  END IF;

  SELECT * INTO v
  FROM public.producao_processos
  WHERE id = p_processo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  CASE p_acao
    WHEN 'iniciar' THEN
      IF v.status <> 'planejado' THEN RAISE EXCEPTION 'Somente etapa planejada pode ser iniciada'; END IF;
      v_novo := 'em_andamento';
    WHEN 'pausar' THEN
      IF v.status <> 'em_andamento' OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A pausa exige etapa em andamento e justificativa';
      END IF;
      v_novo := 'pausado';
    WHEN 'retomar' THEN
      IF v.status <> 'pausado' THEN RAISE EXCEPTION 'Somente etapa pausada pode ser retomada'; END IF;
      v_novo := 'em_andamento';
    WHEN 'bloquear' THEN
      IF v.status <> 'em_andamento' OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'O bloqueio exige etapa em andamento e justificativa';
      END IF;
      v_novo := 'bloqueado';
    WHEN 'desbloquear' THEN
      IF v.status <> 'bloqueado' OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'O desbloqueio exige justificativa';
      END IF;
      v_novo := 'em_andamento';
    WHEN 'finalizar' THEN
      IF v.status <> 'em_andamento' OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A finalização exige etapa em andamento e justificativa';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.producao_apontamentos
        WHERE processo_id = p_processo_id AND status = 'lancado'
      ) THEN
        RAISE EXCEPTION 'Existem apontamentos pendentes de conferência';
      END IF;
      v_novo := 'finalizado';
    WHEN 'cancelar' THEN
      IF v.status IN ('finalizado','cancelado') OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'O cancelamento exige etapa aberta e justificativa';
      END IF;
      v_novo := 'cancelado';
    WHEN 'reabrir' THEN
      IF v.status NOT IN ('finalizado','cancelado') OR BTRIM(COALESCE(p_justificativa,'')) = '' THEN
        RAISE EXCEPTION 'A reabertura exige etapa encerrada e justificativa';
      END IF;
      v_novo := 'em_andamento';
    ELSE
      RAISE EXCEPTION 'Ação de etapa desconhecida';
  END CASE;

  UPDATE public.producao_processos SET
    status = v_novo,
    data_inicio_real = CASE WHEN p_acao = 'iniciar' THEN CURRENT_DATE ELSE data_inicio_real END,
    data_fim_real = CASE WHEN p_acao = 'finalizar' THEN CURRENT_DATE WHEN p_acao = 'reabrir' THEN NULL ELSE data_fim_real END,
    motivo_pausa = CASE WHEN p_acao = 'pausar' THEN p_justificativa ELSE motivo_pausa END,
    motivo_bloqueio = CASE WHEN p_acao = 'bloquear' THEN p_justificativa WHEN p_acao = 'desbloquear' THEN NULL ELSE motivo_bloqueio END,
    motivo_cancelamento = CASE WHEN p_acao = 'cancelar' THEN p_justificativa WHEN p_acao = 'reabrir' THEN NULL ELSE motivo_cancelamento END,
    finalizado_por_id = CASE WHEN p_acao = 'finalizar' THEN v_user WHEN p_acao = 'reabrir' THEN NULL ELSE finalizado_por_id END,
    finalizado_por_nome_snapshot = CASE WHEN p_acao = 'finalizar' THEN v_nome WHEN p_acao = 'reabrir' THEN NULL ELSE finalizado_por_nome_snapshot END,
    finalizado_em = CASE WHEN p_acao = 'finalizar' THEN NOW() WHEN p_acao = 'reabrir' THEN NULL ELSE finalizado_em END,
    cancelado_por_id = CASE WHEN p_acao = 'cancelar' THEN v_user WHEN p_acao = 'reabrir' THEN NULL ELSE cancelado_por_id END,
    cancelado_por_nome_snapshot = CASE WHEN p_acao = 'cancelar' THEN v_nome WHEN p_acao = 'reabrir' THEN NULL ELSE cancelado_por_nome_snapshot END,
    cancelado_em = CASE WHEN p_acao = 'cancelar' THEN NOW() WHEN p_acao = 'reabrir' THEN NULL ELSE cancelado_em END,
    atualizado_por_id = v_user,
    atualizado_por_nome_snapshot = v_nome,
    updated_at = NOW()
  WHERE id = p_processo_id;

  INSERT INTO public.producao_processo_eventos(
    processo_id, tipo_evento, status_anterior, novo_status,
    usuario_responsavel_id, nome_usuario_snapshot, justificativa,
    valores_anteriores, valores_posteriores
  ) VALUES (
    p_processo_id, p_acao, v.status, v_novo,
    v_user, v_nome, p_justificativa,
    JSONB_BUILD_OBJECT('status', v.status),
    JSONB_BUILD_OBJECT('status', v_novo)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Tarefas e equipe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_tarefa_producao(
  p_nome TEXT,
  p_categoria TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('tarefas') THEN
    RAISE EXCEPTION 'Sem permissão para cadastrar tarefas';
  END IF;
  IF BTRIM(COALESCE(p_nome,'')) = '' THEN RAISE EXCEPTION 'Nome da tarefa é obrigatório'; END IF;

  INSERT INTO public.producao_tarefas(nome, categoria)
  VALUES (BTRIM(p_nome), NULLIF(BTRIM(p_categoria), ''))
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Já existe uma tarefa ativa com esse nome';
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_membro_producao(
  p_id UUID DEFAULT NULL,
  p_nome TEXT DEFAULT NULL,
  p_apelido TEXT DEFAULT NULL,
  p_funcao TEXT DEFAULT NULL,
  p_valor_hora NUMERIC DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_nome TEXT := BTRIM(COALESCE(p_nome,''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('membros') THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar a equipe';
  END IF;
  IF v_nome = '' THEN RAISE EXCEPTION 'Nome do membro é obrigatório'; END IF;
  IF p_valor_hora IS NOT NULL AND p_valor_hora < 0 THEN RAISE EXCEPTION 'Valor-hora inválido'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.producao_membros(
      nome, nome_snapshot, origem, apelido, funcao, valor_hora, ativo
    ) VALUES (
      v_nome, v_nome, 'producao'::public.producao_membro_origem,
      NULLIF(BTRIM(p_apelido),''), NULLIF(BTRIM(p_funcao),''),
      p_valor_hora, COALESCE(p_ativo, TRUE)
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.producao_membros SET
      nome = v_nome,
      nome_snapshot = v_nome,
      apelido = NULLIF(BTRIM(p_apelido),''),
      funcao = NULLIF(BTRIM(p_funcao),''),
      valor_hora = p_valor_hora,
      ativo = COALESCE(p_ativo, TRUE),
      updated_at = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Apontamentos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_apontamento_producao(
  p_data DATE,
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_id UUID;
  v_membro RECORD;
  v_processo public.producao_processos%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('lancar') THEN
    RAISE EXCEPTION 'Sem permissão para lançar apontamentos';
  END IF;
  IF NUM_NONNULLS(p_processo_id, p_projeto_local_id) <> 1 THEN
    RAISE EXCEPTION 'Selecione uma etapa ou um projeto/local avulso';
  END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Data do apontamento é obrigatória'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF COALESCE(p_minutos_produtivos,0) + COALESCE(p_minutos_improdutivos,0) <> p_duracao_minutos THEN
    RAISE EXCEPTION 'A soma dos tempos deve ser igual à duração';
  END IF;
  IF COALESCE(p_minutos_improdutivos,0) > 0 AND BTRIM(COALESCE(p_motivo_improdutivo,'')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;
  IF COALESCE(ARRAY_LENGTH(p_membros,1),0) = 0 THEN RAISE EXCEPTION 'Informe ao menos um membro'; END IF;

  IF p_processo_id IS NOT NULL THEN
    SELECT * INTO v_processo
    FROM public.producao_processos
    WHERE id = p_processo_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;
    IF v_processo.status <> 'em_andamento' THEN RAISE EXCEPTION 'A etapa não está em andamento'; END IF;
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_apontamentos(
    data, processo_id, projeto_local_id, tarefa_id, local_tipo,
    quantidade_produzida, inicio, termino, duracao_minutos,
    minutos_produtivos, minutos_improdutivos, motivo_improdutivo,
    observacoes, criado_por_id, criado_por_nome_snapshot
  ) VALUES (
    p_data, p_processo_id, p_projeto_local_id, p_tarefa_id, p_local_tipo,
    p_quantidade_produzida, p_inicio, p_termino, p_duracao_minutos,
    p_minutos_produtivos, p_minutos_improdutivos,
    NULLIF(BTRIM(p_motivo_improdutivo),''),
    NULLIF(BTRIM(p_observacoes),''), v_user, v_nome
  ) RETURNING id INTO v_id;

  FOR v_membro IN
    SELECT id, nome, valor_hora
    FROM public.producao_membros
    WHERE id = ANY(p_membros) AND ativo = TRUE
  LOOP
    INSERT INTO public.producao_apontamento_membros(
      apontamento_id, membro_id, nome_snapshot, valor_hora_snapshot
    ) VALUES (
      v_id, v_membro.id, v_membro.nome, v_membro.valor_hora
    );
  END LOOP;

  IF (
    SELECT COUNT(*) FROM public.producao_apontamento_membros
    WHERE apontamento_id = v_id AND membro_id IS NOT NULL
  ) <> CARDINALITY(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  ) VALUES (
    v_id, 'criacao', v_user, v_nome,
    JSONB_BUILD_OBJECT('processo_id', p_processo_id, 'projeto_local_id', p_projeto_local_id)::TEXT
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_apontamento_producao(
  p_apontamento_id UUID,
  p_data DATE,
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
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_atual public.producao_apontamentos%ROWTYPE;
  v_membro RECORD;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('editar_apontamento') THEN
    RAISE EXCEPTION 'Sem permissão para editar apontamentos';
  END IF;

  SELECT * INTO v_atual
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_atual.status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento pendente pode ser editado'; END IF;
  IF NUM_NONNULLS(p_processo_id, p_projeto_local_id) <> 1 THEN RAISE EXCEPTION 'Selecione uma etapa ou um projeto/local avulso'; END IF;
  IF p_termino <= p_inicio OR p_duracao_minutos <= 0 THEN RAISE EXCEPTION 'Horário inválido'; END IF;
  IF COALESCE(p_minutos_produtivos,0) + COALESCE(p_minutos_improdutivos,0) <> p_duracao_minutos THEN
    RAISE EXCEPTION 'A soma dos tempos deve ser igual à duração';
  END IF;
  IF COALESCE(p_minutos_improdutivos,0) > 0 AND BTRIM(COALESCE(p_motivo_improdutivo,'')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo do tempo improdutivo';
  END IF;
  IF COALESCE(ARRAY_LENGTH(p_membros,1),0) = 0 THEN RAISE EXCEPTION 'Informe ao menos um membro'; END IF;

  IF p_processo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.producao_processos
    WHERE id = p_processo_id AND status = 'em_andamento'
  ) THEN
    RAISE EXCEPTION 'A etapa não está em andamento';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  v_antes := TO_JSONB(v_atual) - 'updated_at';

  UPDATE public.producao_apontamentos SET
    data = p_data,
    processo_id = p_processo_id,
    projeto_local_id = p_projeto_local_id,
    tarefa_id = p_tarefa_id,
    local_tipo = p_local_tipo,
    quantidade_produzida = p_quantidade_produzida,
    inicio = p_inicio,
    termino = p_termino,
    duracao_minutos = p_duracao_minutos,
    minutos_produtivos = p_minutos_produtivos,
    minutos_improdutivos = p_minutos_improdutivos,
    motivo_improdutivo = NULLIF(BTRIM(p_motivo_improdutivo),''),
    observacoes = NULLIF(BTRIM(p_observacoes),''),
    ultima_edicao_por_id = v_user,
    ultima_edicao_por_nome_snapshot = v_nome,
    ultima_edicao_em = NOW(),
    updated_at = NOW()
  WHERE id = p_apontamento_id;

  DELETE FROM public.producao_apontamento_membros
  WHERE apontamento_id = p_apontamento_id;

  FOR v_membro IN
    SELECT id, nome, valor_hora
    FROM public.producao_membros
    WHERE id = ANY(p_membros) AND ativo = TRUE
  LOOP
    INSERT INTO public.producao_apontamento_membros(
      apontamento_id, membro_id, nome_snapshot, valor_hora_snapshot
    ) VALUES (
      p_apontamento_id, v_membro.id, v_membro.nome, v_membro.valor_hora
    );
  END LOOP;

  IF (
    SELECT COUNT(*) FROM public.producao_apontamento_membros
    WHERE apontamento_id = p_apontamento_id AND membro_id IS NOT NULL
  ) <> CARDINALITY(p_membros) THEN
    RAISE EXCEPTION 'Um ou mais membros são inválidos ou inativos';
  END IF;

  SELECT TO_JSONB(a) - 'updated_at'
  INTO v_depois
  FROM public.producao_apontamentos a
  WHERE a.id = p_apontamento_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot,
    valor_anterior, valor_novo
  ) VALUES (
    p_apontamento_id, 'edicao', v_user, v_nome,
    v_antes::TEXT, v_depois::TEXT
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_apontamento_producao(
  p_apontamento_id UUID,
  p_justificativa TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_status TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('cancelar_apontamento') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar apontamentos';
  END IF;
  IF BTRIM(COALESCE(p_justificativa,'')) = '' THEN RAISE EXCEPTION 'Justificativa obrigatória'; END IF;

  SELECT status INTO v_status
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento pendente pode ser cancelado'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  UPDATE public.producao_apontamentos SET
    status = 'cancelado',
    cancelado_por_id = v_user,
    cancelado_por_nome_snapshot = v_nome,
    cancelado_em = NOW(),
    motivo_cancelamento = BTRIM(p_justificativa),
    updated_at = NOW()
  WHERE id = p_apontamento_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, campo_alterado, valor_anterior, valor_novo,
    usuario_id, nome_usuario_snapshot, justificativa
  ) VALUES (
    p_apontamento_id, 'cancelamento', 'status', v_status, 'cancelado',
    v_user, v_nome, BTRIM(p_justificativa)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.conferir_apontamento_producao(
  p_apontamento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_status TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('conferir_apontamento') THEN
    RAISE EXCEPTION 'Sem permissão para conferir apontamentos';
  END IF;

  SELECT status INTO v_status
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Somente apontamento pendente pode ser conferido'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  UPDATE public.producao_apontamentos SET
    status = 'conferido',
    conferido_por_id = v_user,
    conferido_por_nome_snapshot = v_nome,
    conferido_em = NOW(),
    updated_at = NOW()
  WHERE id = p_apontamento_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, campo_alterado, valor_anterior, valor_novo,
    usuario_id, nome_usuario_snapshot
  ) VALUES (
    p_apontamento_id, 'conferencia', 'status', v_status, 'conferido',
    v_user, v_nome
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_resumo_finalizacao_processo(
  p_processo_id UUID
)
RETURNS TABLE(
  quantidade_planejada NUMERIC,
  quantidade_realizada NUMERIC,
  percentual_conclusao NUMERIC,
  total_apontamentos BIGINT,
  apontamentos_pendentes BIGINT,
  minutos_totais BIGINT,
  minutos_produtivos BIGINT,
  minutos_improdutivos BIGINT,
  horas_homem NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.usuario_tem_permissao_producao('visualizar') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o resumo da etapa';
  END IF;

  RETURN QUERY
  SELECT
    p.quantidade_planejada,
    COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'), 0),
    CASE WHEN COALESCE(p.quantidade_planejada,0) > 0 THEN
      ROUND((COALESCE(SUM(a.quantidade_produzida) FILTER (WHERE a.status='conferido'),0) / p.quantidade_planejada) * 100, 2)
    ELSE NULL END,
    COUNT(a.id),
    COUNT(a.id) FILTER (WHERE a.status = 'lancado'),
    COALESCE(SUM(a.duracao_minutos) FILTER (WHERE a.status <> 'cancelado'),0)::BIGINT,
    COALESCE(SUM(a.minutos_produtivos) FILTER (WHERE a.status <> 'cancelado'),0)::BIGINT,
    COALESCE(SUM(a.minutos_improdutivos) FILTER (WHERE a.status <> 'cancelado'),0)::BIGINT,
    (COALESCE(SUM(a.duracao_minutos * COALESCE(m.qtd,0)) FILTER (WHERE a.status <> 'cancelado'),0) / 60.0)::NUMERIC
  FROM public.producao_processos p
  LEFT JOIN public.producao_apontamentos a ON a.processo_id = p.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::NUMERIC AS qtd
    FROM public.producao_apontamento_membros pam
    WHERE pam.apontamento_id = a.id
  ) m ON TRUE
  WHERE p.id = p_processo_id
  GROUP BY p.id, p.quantidade_planejada;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Anexos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_anexo_producao(
  p_apontamento_id UUID,
  p_file_path TEXT,
  p_file_name TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
  v_status TEXT;
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('anexos') THEN
    RAISE EXCEPTION 'Sem permissão para anexar imagens';
  END IF;

  SELECT status INTO v_status
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Fotos só podem ser adicionadas enquanto o apontamento estiver pendente'; END IF;
  IF p_mime_type NOT IN ('image/jpeg','image/png','image/webp') THEN RAISE EXCEPTION 'Formato de imagem não permitido'; END IF;
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 OR p_size_bytes > 10485760 THEN RAISE EXCEPTION 'A imagem deve possuir até 10 MB'; END IF;
  IF BTRIM(COALESCE(p_file_path,'')) = '' OR BTRIM(COALESCE(p_file_name,'')) = '' THEN RAISE EXCEPTION 'Arquivo inválido'; END IF;
  IF SPLIT_PART(p_file_path,'/',1) <> p_apontamento_id::TEXT THEN RAISE EXCEPTION 'Caminho incompatível com o apontamento'; END IF;

  INSERT INTO public.producao_apontamento_anexos(
    apontamento_id, file_path, file_name, mime_type, size_bytes, uploaded_by
  ) VALUES (
    p_apontamento_id, p_file_path, BTRIM(p_file_name), p_mime_type, p_size_bytes, v_user
  ) RETURNING id INTO v_id;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  ) VALUES (
    p_apontamento_id, 'anexo_adicionado', v_user, v_nome,
    JSONB_BUILD_OBJECT('anexo_id', v_id, 'file_name', BTRIM(p_file_name))::TEXT
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_anexo_producao(
  p_anexo_id UUID
)
RETURNS TABLE(file_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_apontamento UUID;
  v_path TEXT;
  v_status TEXT;
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('anexos') THEN
    RAISE EXCEPTION 'Sem permissão para remover imagens';
  END IF;

  SELECT a.apontamento_id, a.file_path, ap.status
  INTO v_apontamento, v_path, v_status
  FROM public.producao_apontamento_anexos a
  JOIN public.producao_apontamentos ap ON ap.id = a.apontamento_id
  WHERE a.id = p_anexo_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN RAISE EXCEPTION 'Anexo não encontrado'; END IF;
  IF v_status <> 'lancado' THEN RAISE EXCEPTION 'Fotos só podem ser removidas enquanto o apontamento estiver pendente'; END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  DELETE FROM public.producao_apontamento_anexos WHERE id = p_anexo_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_anterior
  ) VALUES (
    v_apontamento, 'anexo_removido', v_user, v_nome,
    JSONB_BUILD_OBJECT('anexo_id', p_anexo_id, 'file_path', v_path)::TEXT
  );

  RETURN QUERY SELECT v_path;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Storage privado
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS producao_storage_ler ON storage.objects;
DROP POLICY IF EXISTS producao_storage_inserir ON storage.objects;
DROP POLICY IF EXISTS producao_storage_excluir ON storage.objects;

CREATE POLICY producao_storage_ler
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('visualizar')
);

CREATE POLICY producao_storage_inserir
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('anexos')
  AND EXISTS (
    SELECT 1 FROM public.producao_apontamentos ap
    WHERE ap.id::TEXT = (storage.foldername(name))[1]
      AND ap.status = 'lancado'
  )
);

CREATE POLICY producao_storage_excluir
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('anexos')
);

-- ---------------------------------------------------------------------------
-- 8. Grants das RPCs recuperadas
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'obter_proximo_codigo_etapa_producao',
        'transicao_processo_producao',
        'criar_tarefa_producao',
        'salvar_membro_producao',
        'criar_apontamento_producao',
        'editar_apontamento_producao',
        'cancelar_apontamento_producao',
        'conferir_apontamento_producao',
        'obter_resumo_finalizacao_processo',
        'registrar_anexo_producao',
        'remover_anexo_producao'
      )
  LOOP
    EXECUTE FORMAT('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.assinatura);
    EXECUTE FORMAT('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.assinatura);
  END LOOP;
END $$;

COMMIT;
