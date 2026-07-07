-- Fundação isolada do módulo de Produção.
-- Estas tabelas apenas registram dados produtivos e referências a movimentações
-- existentes. Nenhum trigger ou função desta migration altera estoque.

CREATE TABLE IF NOT EXISTS public.producao_tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_tarefas_nome_nao_vazio CHECK (btrim(nome) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS producao_tarefas_nome_ativo_unique
  ON public.producao_tarefas (lower(btrim(nome)))
  WHERE ativo;

CREATE TABLE IF NOT EXISTS public.producao_apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  projeto_local_id UUID NOT NULL REFERENCES public.locais_utilizacao(id),
  tarefa_id UUID NOT NULL REFERENCES public.producao_tarefas(id),
  local_tipo TEXT NOT NULL,
  quantidade_produzida NUMERIC NULL,
  inicio TIME NOT NULL,
  termino TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  observacoes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'lancado',
  criado_por_id UUID NULL,
  conferido_por_id UUID NULL,
  conferido_em TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_apontamentos_local_tipo_valido
    CHECK (local_tipo IN ('Fábrica', 'Execução')),
  CONSTRAINT producao_apontamentos_status_valido
    CHECK (status IN ('lancado', 'conferido', 'cancelado')),
  CONSTRAINT producao_apontamentos_horario_valido CHECK (termino > inicio),
  CONSTRAINT producao_apontamentos_duracao_positiva CHECK (duracao_minutos > 0)
);

CREATE TABLE IF NOT EXISTS public.producao_apontamento_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id UUID NOT NULL
    REFERENCES public.producao_apontamentos(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES public.solicitantes(id),
  nome_snapshot TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_apontamento_membros_nome_nao_vazio
    CHECK (btrim(nome_snapshot) <> ''),
  CONSTRAINT producao_apontamento_membros_unicos
    UNIQUE (apontamento_id, solicitante_id)
);

CREATE TABLE IF NOT EXISTS public.producao_materiais_projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES public.movements(id) ON DELETE RESTRICT,
  projeto_local_id UUID NOT NULL REFERENCES public.locais_utilizacao(id),
  apontamento_id UUID NULL
    REFERENCES public.producao_apontamentos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id),
  quantidade NUMERIC NOT NULL,
  item_snapshot JSONB NOT NULL,
  observacoes_producao TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_materiais_projeto_movement_unique UNIQUE (movement_id),
  CONSTRAINT producao_materiais_projeto_quantidade_positiva CHECK (quantidade > 0)
);

CREATE INDEX IF NOT EXISTS producao_apontamentos_data_idx
  ON public.producao_apontamentos (data);
CREATE INDEX IF NOT EXISTS producao_apontamentos_projeto_local_id_idx
  ON public.producao_apontamentos (projeto_local_id);
CREATE INDEX IF NOT EXISTS producao_apontamentos_tarefa_id_idx
  ON public.producao_apontamentos (tarefa_id);
CREATE INDEX IF NOT EXISTS producao_apontamentos_status_idx
  ON public.producao_apontamentos (status);
CREATE INDEX IF NOT EXISTS producao_apontamentos_local_tipo_idx
  ON public.producao_apontamentos (local_tipo);
CREATE INDEX IF NOT EXISTS producao_apontamento_membros_apontamento_id_idx
  ON public.producao_apontamento_membros (apontamento_id);
CREATE INDEX IF NOT EXISTS producao_apontamento_membros_solicitante_id_idx
  ON public.producao_apontamento_membros (solicitante_id);
CREATE INDEX IF NOT EXISTS producao_materiais_projeto_movement_id_idx
  ON public.producao_materiais_projeto (movement_id);
CREATE INDEX IF NOT EXISTS producao_materiais_projeto_projeto_local_id_idx
  ON public.producao_materiais_projeto (projeto_local_id);
CREATE INDEX IF NOT EXISTS producao_materiais_projeto_item_id_idx
  ON public.producao_materiais_projeto (item_id);

DROP TRIGGER IF EXISTS update_producao_tarefas_updated_at
  ON public.producao_tarefas;
CREATE TRIGGER update_producao_tarefas_updated_at
  BEFORE UPDATE ON public.producao_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_producao_apontamentos_updated_at
  ON public.producao_apontamentos;
CREATE TRIGGER update_producao_apontamentos_updated_at
  BEFORE UPDATE ON public.producao_apontamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.producao_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_apontamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_apontamento_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_materiais_projeto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar tarefas de produção"
  ON public.producao_tarefas;
DROP POLICY IF EXISTS "Usuários autenticados podem criar tarefas de produção"
  ON public.producao_tarefas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar tarefas de produção"
  ON public.producao_tarefas;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir tarefas de produção"
  ON public.producao_tarefas;
CREATE POLICY "Usuários autenticados podem visualizar tarefas de produção"
  ON public.producao_tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar tarefas de produção"
  ON public.producao_tarefas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar tarefas de produção"
  ON public.producao_tarefas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir tarefas de produção"
  ON public.producao_tarefas FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar apontamentos de produção"
  ON public.producao_apontamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar apontamentos de produção"
  ON public.producao_apontamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar apontamentos de produção"
  ON public.producao_apontamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir apontamentos de produção"
  ON public.producao_apontamentos;
CREATE POLICY "Usuários autenticados podem visualizar apontamentos de produção"
  ON public.producao_apontamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar apontamentos de produção"
  ON public.producao_apontamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar apontamentos de produção"
  ON public.producao_apontamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir apontamentos de produção"
  ON public.producao_apontamentos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar membros de apontamentos"
  ON public.producao_apontamento_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem criar membros de apontamentos"
  ON public.producao_apontamento_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar membros de apontamentos"
  ON public.producao_apontamento_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir membros de apontamentos"
  ON public.producao_apontamento_membros;
CREATE POLICY "Usuários autenticados podem visualizar membros de apontamentos"
  ON public.producao_apontamento_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar membros de apontamentos"
  ON public.producao_apontamento_membros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar membros de apontamentos"
  ON public.producao_apontamento_membros FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir membros de apontamentos"
  ON public.producao_apontamento_membros FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar materiais da produção"
  ON public.producao_materiais_projeto;
DROP POLICY IF EXISTS "Usuários autenticados podem criar materiais da produção"
  ON public.producao_materiais_projeto;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar materiais da produção"
  ON public.producao_materiais_projeto;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir materiais da produção"
  ON public.producao_materiais_projeto;
CREATE POLICY "Usuários autenticados podem visualizar materiais da produção"
  ON public.producao_materiais_projeto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar materiais da produção"
  ON public.producao_materiais_projeto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar materiais da produção"
  ON public.producao_materiais_projeto FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir materiais da produção"
  ON public.producao_materiais_projeto FOR DELETE TO authenticated USING (true);
