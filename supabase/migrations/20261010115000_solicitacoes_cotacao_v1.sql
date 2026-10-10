BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.cotacao_solicitacoes_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.cotacao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint NOT NULL DEFAULT nextval('public.cotacao_solicitacoes_numero_seq'),
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('insumo','frete','global')),
  status text NOT NULL DEFAULT 'aguardando_propostas'
    CHECK (status IN ('aguardando_propostas','em_analise','escolhida','encerrada','cancelada')),
  projeto_centro_custo text,
  data_limite date,
  fornecedores_solicitados text,
  observacoes text,
  criado_por uuid DEFAULT auth.uid(),
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(numero)
);

ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid REFERENCES public.cotacao_solicitacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cotacoes_solicitacao_idx ON public.cotacoes(solicitacao_id);
CREATE INDEX IF NOT EXISTS cotacao_solicitacoes_status_idx ON public.cotacao_solicitacoes(status, created_at DESC);

ALTER TABLE public.cotacao_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cotacao_solicitacoes_select ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_select ON public.cotacao_solicitacoes
FOR SELECT TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'));

DROP POLICY IF EXISTS cotacao_solicitacoes_insert ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_insert ON public.cotacao_solicitacoes
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'));

DROP POLICY IF EXISTS cotacao_solicitacoes_update ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_update ON public.cotacao_solicitacoes
FOR UPDATE TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'))
WITH CHECK (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'));

DROP POLICY IF EXISTS cotacao_solicitacoes_delete ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_delete ON public.cotacao_solicitacoes
FOR DELETE TO authenticated
USING (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra'));

COMMIT;