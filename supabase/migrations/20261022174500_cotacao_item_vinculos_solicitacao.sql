BEGIN;
CREATE TABLE IF NOT EXISTS public.cotacao_item_vinculos_solicitacao (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cotacao_item_id uuid NOT NULL REFERENCES public.cotacao_itens(id) ON DELETE CASCADE,
 solicitacao_item_id uuid NOT NULL REFERENCES public.cotacao_solicitacao_itens(id) ON DELETE RESTRICT,
 quantidade_alocada numeric NOT NULL CHECK (quantidade_alocada>0),
 valor_alocado numeric NOT NULL CHECK (valor_alocado>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cotacao_item_id,solicitacao_item_id)
);
CREATE INDEX IF NOT EXISTS cotacao_vinculos_por_solicitacao_idx ON public.cotacao_item_vinculos_solicitacao(solicitacao_item_id);
ALTER TABLE public.cotacao_item_vinculos_solicitacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY cotacao_vinculos_read ON public.cotacao_item_vinculos_solicitacao FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.cotacao_itens ci JOIN public.cotacoes c ON c.id=ci.cotacao_id
 WHERE ci.id=cotacao_item_id AND (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
 OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.ativo AND p.tipo_usuario='estoquista')))
);
CREATE POLICY cotacao_vinculos_insert ON public.cotacao_item_vinculos_solicitacao FOR INSERT TO authenticated WITH CHECK(
 EXISTS(SELECT 1 FROM public.cotacao_itens ci JOIN public.cotacoes c ON c.id=ci.cotacao_id
 WHERE ci.id=cotacao_item_id AND c.financeiro_necessidade_id IS NULL AND (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
 OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.ativo AND p.tipo_usuario='estoquista')))
);
CREATE POLICY cotacao_vinculos_delete ON public.cotacao_item_vinculos_solicitacao FOR DELETE TO authenticated USING(
 EXISTS(SELECT 1 FROM public.cotacao_itens ci JOIN public.cotacoes c ON c.id=ci.cotacao_id
 WHERE ci.id=cotacao_item_id AND c.financeiro_necessidade_id IS NULL AND (public.is_admin() OR public.permissao_individual_efetiva(auth.uid(),'pode_pedido_compra')
 OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid() AND p.ativo AND p.tipo_usuario='estoquista')))
);
COMMIT;