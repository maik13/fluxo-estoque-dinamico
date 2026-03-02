
-- Sequência para numeração automática
CREATE SEQUENCE IF NOT EXISTS solicitacoes_material_numero_seq START 1;

-- Tabela principal de solicitações de material
CREATE TABLE public.solicitacoes_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('solicitacoes_material_numero_seq'),
  solicitante_id UUID NOT NULL,
  solicitante_nome TEXT NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  estoque_id UUID REFERENCES public.estoques(id),
  aprovado_por_id UUID,
  aprovado_por_nome TEXT,
  data_aprovacao TIMESTAMPTZ,
  solicitacao_retirada_id UUID REFERENCES public.solicitacoes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de itens da solicitação de material
CREATE TABLE public.solicitacao_material_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_material_id UUID NOT NULL REFERENCES public.solicitacoes_material(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id),
  nome_item TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'un',
  item_snapshot JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.solicitacoes_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_material_itens ENABLE ROW LEVEL SECURITY;

-- Policies para solicitacoes_material
CREATE POLICY "Usuários autenticados podem ver solicitações de material"
  ON public.solicitacoes_material FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar solicitações de material"
  ON public.solicitacoes_material FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Gestores podem atualizar solicitações de material"
  ON public.solicitacoes_material FOR UPDATE
  USING (can_manage_inventory());

CREATE POLICY "Admins podem deletar solicitações de material"
  ON public.solicitacoes_material FOR DELETE
  USING (is_admin());

-- Policies para solicitacao_material_itens
CREATE POLICY "Usuários autenticados podem ver itens de solicitação de material"
  ON public.solicitacao_material_itens FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar itens de solicitação de material"
  ON public.solicitacao_material_itens FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Gestores podem atualizar itens de solicitação de material"
  ON public.solicitacao_material_itens FOR UPDATE
  USING (can_manage_inventory());

CREATE POLICY "Admins podem deletar itens de solicitação de material"
  ON public.solicitacao_material_itens FOR DELETE
  USING (is_admin());

-- Trigger updated_at
CREATE TRIGGER update_solicitacoes_material_updated_at
  BEFORE UPDATE ON public.solicitacoes_material
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Realtime
ALTER TABLE public.solicitacoes_material REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacao_material_itens REPLICA IDENTITY FULL;
