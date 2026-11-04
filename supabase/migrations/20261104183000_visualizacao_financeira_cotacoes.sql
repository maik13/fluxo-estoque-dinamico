-- O acesso financeiro é somente leitura na Central de Cotações.
-- Não altera as policies de INSERT, UPDATE ou DELETE.

DROP POLICY IF EXISTS cotacoes_visualizacao_financeira_select ON public.cotacoes;
CREATE POLICY cotacoes_visualizacao_financeira_select
ON public.cotacoes FOR SELECT TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro'));

DROP POLICY IF EXISTS cotacao_solicitacoes_visualizacao_financeira_select ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_visualizacao_financeira_select
ON public.cotacao_solicitacoes FOR SELECT TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro'));

DROP POLICY IF EXISTS cotacao_itens_visualizacao_financeira_select ON public.cotacao_itens;
CREATE POLICY cotacao_itens_visualizacao_financeira_select
ON public.cotacao_itens FOR SELECT TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro'));

DROP POLICY IF EXISTS cotacao_solicitacao_itens_visualizacao_financeira_select ON public.cotacao_solicitacao_itens;
CREATE POLICY cotacao_solicitacao_itens_visualizacao_financeira_select
ON public.cotacao_solicitacao_itens FOR SELECT TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro'));

DROP POLICY IF EXISTS cotacao_solicitacoes_vinculos_visualizacao_financeira_select ON public.cotacao_solicitacoes_vinculos;
CREATE POLICY cotacao_solicitacoes_vinculos_visualizacao_financeira_select
ON public.cotacao_solicitacoes_vinculos FOR SELECT TO authenticated
USING (public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro'));

DROP POLICY IF EXISTS cotacoes_documentos_visualizacao_financeira_select ON storage.objects;
CREATE POLICY cotacoes_documentos_visualizacao_financeira_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cotacoes-documentos'
  AND public.permissao_individual_efetiva(auth.uid(), 'pode_acessar_financeiro')
);
