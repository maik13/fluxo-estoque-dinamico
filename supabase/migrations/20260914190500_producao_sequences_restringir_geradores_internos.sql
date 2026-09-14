-- Restringe os geradores definitivos de identificadores ao uso interno do banco.
-- O frontend continua usando as RPCs públicas de Produção; usuários autenticados
-- não precisam (nem devem) conseguir consumir números diretamente.

BEGIN;

REVOKE ALL ON FUNCTION public.proximo_numero_ordem_producao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proximo_numero_ordem_producao() FROM authenticated;

REVOKE ALL ON FUNCTION public.proximo_codigo_etapa_producao_definitivo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proximo_codigo_etapa_producao_definitivo() FROM authenticated;

REVOKE ALL ON FUNCTION public.trg_sincronizar_sequence_op_producao() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sincronizar_sequence_etapa_producao() FROM PUBLIC;

-- O preview do próximo código da Etapa é deliberadamente público apenas para
-- usuários autenticados, pois é exibido no formulário e não consome a sequence.
REVOKE ALL ON FUNCTION public.obter_proximo_codigo_etapa_producao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_proximo_codigo_etapa_producao() TO authenticated;

COMMIT;
