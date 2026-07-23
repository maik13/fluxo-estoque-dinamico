-- Recuperação idempotente do núcleo do Módulo de Produção.
-- Destinada a bancos que receberam apenas parte das migrations anteriores.
-- Não remove nem sobrescreve registros existentes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.producao_permissoes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pode_visualizar BOOLEAN NOT NULL DEFAULT false,
  pode_lancar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  pode_gerenciar_processos BOOLEAN NOT NULL DEFAULT false,
  pode_vincular_membros BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.producao_permissoes
  ADD COLUMN IF NOT EXISTS pode_visualizar_auditoria BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_projetos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_finalizar_processos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_reabrir_processos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_editar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_cancelar_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_conferir_apontamentos BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_tarefas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_membros BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_gerenciar_anexos BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.producao_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  cliente TEXT NULL,
  cidade TEXT NULL,
  uf TEXT NULL,
  local_execucao TEXT NULL,
  endereco_execucao TEXT NULL,
  data_inicio_prevista DATE NULL,
  data_fim_prevista DATE NULL,
  responsavel_id UUID NULL,
  responsavel_nome_snapshot TEXT NULL,
  observacoes TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por_id UUID NULL,
  criado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  local_utilizacao_id UUID NULL REFERENCES public.locais_utilizacao(id) ON DELETE RESTRICT,
  CONSTRAINT producao_projetos_nome_vazio CHECK (btrim(nome) <> '')
);

ALTER TABLE public.producao_projetos
  ADD COLUMN IF NOT EXISTS descricao TEXT NULL,
  ADD COLUMN IF NOT EXISTS local_utilizacao_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'producao_projetos_local_utilizacao_id_fkey'
      AND conrelid = 'public.producao_projetos'::regclass
  ) THEN
    ALTER TABLE public.producao_projetos
      ADD CONSTRAINT producao_projetos_local_utilizacao_id_fkey
      FOREIGN KEY (local_utilizacao_id)
      REFERENCES public.locais_utilizacao(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS producao_projetos_local_utilizacao_unique
  ON public.producao_projetos(local_utilizacao_id)
  WHERE local_utilizacao_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.producao_processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  projeto_id UUID NOT NULL REFERENCES public.producao_projetos(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  produto_entregavel TEXT NULL,
  unidade_medida TEXT NULL,
  quantidade_planejada NUMERIC NULL,
  status TEXT NOT NULL DEFAULT 'planejado',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  responsavel_id UUID NULL,
  responsavel_nome_snapshot TEXT NULL,
  data_inicio_prevista DATE NULL,
  data_fim_prevista DATE NULL,
  data_inicio_real DATE NULL,
  data_fim_real DATE NULL,
  motivo_pausa TEXT NULL,
  motivo_bloqueio TEXT NULL,
  motivo_cancelamento TEXT NULL,
  observacoes TEXT NULL,
  criado_por_id UUID NULL,
  criado_por_nome_snapshot TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por_id UUID NULL,
  atualizado_por_nome_snapshot TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalizado_por_id UUID NULL,
  finalizado_por_nome_snapshot TEXT NULL,
  finalizado_em TIMESTAMPTZ NULL,
  cancelado_por_id UUID NULL,
  cancelado_por_nome_snapshot TEXT NULL,
  cancelado_em TIMESTAMPTZ NULL,
  CONSTRAINT producao_processos_status_check
    CHECK (status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado', 'finalizado', 'cancelado')),
  CONSTRAINT producao_processos_prioridade_check
    CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente'))
);

CREATE TABLE IF NOT EXISTS public.producao_processo_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.producao_processos(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  status_anterior TEXT NULL,
  novo_status TEXT NULL,
  usuario_responsavel_id UUID NULL,
  nome_usuario_snapshot TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  justificativa TEXT NULL,
  dados_complementares JSONB NULL,
  valores_anteriores JSONB NULL,
  valores_posteriores JSONB NULL
);

ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS processo_id UUID NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS criado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS conferido_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_nome_snapshot TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'producao_apontamentos_processo_id_fkey'
      AND conrelid = 'public.producao_apontamentos'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamentos
      ADD CONSTRAINT producao_apontamentos_processo_id_fkey
      FOREIGN KEY (processo_id)
      REFERENCES public.producao_processos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.producao_apontamento_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id UUID NOT NULL REFERENCES public.producao_apontamentos(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  campo_alterado TEXT NULL,
  valor_anterior TEXT NULL,
  valor_novo TEXT NULL,
  usuario_id UUID NULL,
  nome_usuario_snapshot TEXT NOT NULL,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  justificativa TEXT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.producao_processo_codigo_seq;

DROP TRIGGER IF EXISTS update_producao_projetos_updated_at ON public.producao_projetos;
CREATE TRIGGER update_producao_projetos_updated_at
  BEFORE UPDATE ON public.producao_projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_producao_processos_updated_at ON public.producao_processos;
CREATE TRIGGER update_producao_processos_updated_at
  BEFORE UPDATE ON public.producao_processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.producao_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_processo_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_apontamento_eventos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_producao(p_permissao TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v public.producao_permissoes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v
  FROM public.producao_permissoes
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN CASE p_permissao
    WHEN 'visualizar' THEN v.pode_visualizar OR v.pode_gerenciar_processos
    WHEN 'auditoria' THEN v.pode_visualizar_auditoria
    WHEN 'projetos' THEN v.pode_gerenciar_projetos OR v.pode_gerenciar_processos
    WHEN 'processos' THEN v.pode_gerenciar_processos
    WHEN 'finalizar' THEN v.pode_finalizar_processos OR v.pode_gerenciar_processos
    WHEN 'reabrir' THEN v.pode_reabrir_processos OR v.pode_gerenciar_processos
    WHEN 'lancar' THEN v.pode_lancar_apontamentos
    WHEN 'editar_apontamento' THEN v.pode_editar_apontamentos
    WHEN 'cancelar_apontamento' THEN v.pode_cancelar_apontamentos
    WHEN 'conferir_apontamento' THEN v.pode_conferir_apontamentos
    WHEN 'tarefas' THEN v.pode_gerenciar_tarefas
    WHEN 'membros' THEN v.pode_gerenciar_membros
    WHEN 'vincular_membros' THEN v.pode_vincular_membros
    WHEN 'anexos' THEN v.pode_gerenciar_anexos
    ELSE false
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.usuario_tem_permissao_producao(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_tem_permissao_producao(TEXT) TO authenticated;

DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'producao_permissoes',
        'producao_projetos',
        'producao_processos',
        'producao_processo_eventos',
        'producao_apontamento_eventos'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  END LOOP;
END $$;

CREATE POLICY producao_permissoes_ler_propria
  ON public.producao_permissoes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY producao_projetos_leitura
  ON public.producao_projetos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE POLICY producao_processos_leitura
  ON public.producao_processos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('visualizar'));

CREATE POLICY producao_processo_eventos_leitura
  ON public.producao_processo_eventos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('auditoria'));

CREATE POLICY producao_apontamento_eventos_leitura
  ON public.producao_apontamento_eventos FOR SELECT TO authenticated
  USING (public.usuario_tem_permissao_producao('auditoria'));

COMMIT;
