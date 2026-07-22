-- Etapa 4: Projetos
CREATE TABLE IF NOT EXISTS public.producao_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
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
  CONSTRAINT producao_projetos_nome_vazio CHECK (btrim(nome) <> '')
);

CREATE TRIGGER update_producao_projetos_updated_at
  BEFORE UPDATE ON public.producao_projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.producao_projetos ENABLE ROW LEVEL SECURITY;

-- Etapa 5: Processos
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
  CONSTRAINT producao_processos_status_check CHECK (status IN ('planejado', 'em_andamento', 'pausado', 'bloqueado', 'finalizado', 'cancelado')),
  CONSTRAINT producao_processos_prioridade_check CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente'))
);

CREATE TRIGGER update_producao_processos_updated_at
  BEFORE UPDATE ON public.producao_processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.producao_processos ENABLE ROW LEVEL SECURITY;

-- Eventos de Processo (Histórico)
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

ALTER TABLE public.producao_processo_eventos ENABLE ROW LEVEL SECURITY;

-- Etapa 6: Apontamentos vinculados
ALTER TABLE public.producao_apontamentos
  ADD COLUMN IF NOT EXISTS processo_id UUID NULL REFERENCES public.producao_processos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_id UUID NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_em TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS criado_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS ultima_edicao_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS conferido_por_nome_snapshot TEXT NULL,
  ADD COLUMN IF NOT EXISTS cancelado_por_nome_snapshot TEXT NULL;

-- Auditoria de apontamentos (Append Only)
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

ALTER TABLE public.producao_apontamento_eventos ENABLE ROW LEVEL SECURITY;
