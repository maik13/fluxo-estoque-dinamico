-- Visualização somente leitura da Mai Pavan na Central de Cotações.
-- Não altera as policies de INSERT, UPDATE ou DELETE nem amplia o acesso a outros perfis financeiros.

DROP POLICY IF EXISTS cotacoes_visualizacao_financeira_select ON public.cotacoes;
CREATE POLICY cotacoes_visualizacao_financeira_select
ON public.cotacoes FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS cotacao_solicitacoes_visualizacao_financeira_select ON public.cotacao_solicitacoes;
CREATE POLICY cotacao_solicitacoes_visualizacao_financeira_select
ON public.cotacao_solicitacoes FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS cotacao_itens_visualizacao_financeira_select ON public.cotacao_itens;
CREATE POLICY cotacao_itens_visualizacao_financeira_select
ON public.cotacao_itens FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS cotacao_solicitacao_itens_visualizacao_financeira_select ON public.cotacao_solicitacao_itens;
CREATE POLICY cotacao_solicitacao_itens_visualizacao_financeira_select
ON public.cotacao_solicitacao_itens FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS cotacao_solicitacoes_vinculos_visualizacao_financeira_select ON public.cotacao_solicitacoes_vinculos;
CREATE POLICY cotacao_solicitacoes_vinculos_visualizacao_financeira_select
ON public.cotacao_solicitacoes_vinculos FOR SELECT TO authenticated
USING (auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid);

DROP POLICY IF EXISTS cotacoes_documentos_visualizacao_financeira_select ON storage.objects;
CREATE POLICY cotacoes_documentos_visualizacao_financeira_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cotacoes-documentos'
  AND auth.uid() = '94bd13f0-0ece-4840-9895-599d1291d198'::uuid
);
