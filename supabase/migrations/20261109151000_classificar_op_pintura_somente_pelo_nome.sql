CREATE OR REPLACE FUNCTION public.ordem_producao_e_pintura_v1(p_ordem_producao_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.producao_ordens_producao op
    WHERE op.id = p_ordem_producao_id
      AND LOWER(COALESCE(op.tarefa_nome_snapshot, '')) LIKE '%pintura%'
  );
$$;
