CREATE OR REPLACE FUNCTION public.listar_ops_pintura_pendentes_v1()
RETURNS TABLE(ordem_producao_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT op.id
  FROM public.producao_ordens_producao op
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND public.ordem_producao_e_pintura_v1(op.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.producao_consumos_tinta c
      WHERE c.ordem_producao_id = op.id
        AND c.quantidade_ml > 0
    )
  ORDER BY op.numero;
$$;

REVOKE ALL ON FUNCTION public.listar_ops_pintura_pendentes_v1()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.listar_ops_pintura_pendentes_v1()
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
