CREATE OR REPLACE FUNCTION public.contar_solicitacoes_cotacao_pendentes_v1()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.cotacao_solicitacoes s
  WHERE s.status NOT IN ('encerrada', 'cancelada')
    AND NOT EXISTS (
      SELECT 1
      FROM public.cotacoes c
      WHERE c.arquivo_path IS NOT NULL
        AND (
          c.solicitacao_id = s.id
          OR EXISTS (
            SELECT 1
            FROM public.cotacao_solicitacoes_vinculos v
            WHERE v.cotacao_id = c.id
              AND v.solicitacao_id = s.id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.contar_solicitacoes_cotacao_pendentes_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_solicitacoes_cotacao_pendentes_v1() TO authenticated;

COMMENT ON FUNCTION public.contar_solicitacoes_cotacao_pendentes_v1() IS
'Conta solicitações de cotação ainda sem orçamento PDF vinculado; a fila termina somente após o anexo.';

NOTIFY pgrst, 'reload schema';
