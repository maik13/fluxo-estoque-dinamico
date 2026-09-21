BEGIN;

UPDATE public.producao_apontamentos a
SET demao_numero = NULL
WHERE a.demao_numero IS NOT NULL
  AND a.created_at < TIMESTAMPTZ '2026-09-21 11:32:46+00'
  AND a.ordem_producao_id IS NOT NULL
  AND public.ordem_producao_e_pintura_v1(a.ordem_producao_id);

DROP INDEX IF EXISTS public.ux_producao_apontamentos_op_demao_ativa;

CREATE OR REPLACE FUNCTION public.proxima_demao_pintura_v1(
  p_ordem_producao_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_planejada NUMERIC;
  v_legado NUMERIC := 0;
  v_demaos_legadas INTEGER := 0;
  v_ultima_explicita INTEGER;
  v_total_ultima NUMERIC := 0;
BEGIN
  IF NOT public.ordem_producao_e_pintura_v1(p_ordem_producao_id) THEN
    RETURN NULL;
  END IF;

  SELECT quantidade_planejada INTO v_planejada
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id;

  IF v_planejada IS NULL OR v_planejada <= 0 THEN
    RETURN 1;
  END IF;

  SELECT COALESCE(SUM(COALESCE(a.quantidade_produzida,0)),0)
  INTO v_legado
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = p_ordem_producao_id
    AND a.status <> 'cancelado'
    AND a.demao_numero IS NULL;

  v_demaos_legadas := FLOOR(v_legado / v_planejada)::INTEGER;

  SELECT MAX(a.demao_numero)
  INTO v_ultima_explicita
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = p_ordem_producao_id
    AND a.status <> 'cancelado'
    AND a.demao_numero IS NOT NULL;

  IF v_ultima_explicita IS NULL THEN
    RETURN v_demaos_legadas + 1;
  END IF;

  SELECT COALESCE(SUM(COALESCE(a.quantidade_produzida,0)),0)
  INTO v_total_ultima
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = p_ordem_producao_id
    AND a.status <> 'cancelado'
    AND a.demao_numero = v_ultima_explicita;

  IF v_total_ultima >= v_planejada THEN
    RETURN v_ultima_explicita + 1;
  END IF;

  RETURN v_ultima_explicita;
END;
$$;

REVOKE ALL ON FUNCTION public.proxima_demao_pintura_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proxima_demao_pintura_v1(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.definir_demao_apontamento_pintura_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.ordem_producao_id IS NULL
     OR NOT public.ordem_producao_e_pintura_v1(NEW.ordem_producao_id) THEN
    NEW.demao_numero := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF NEW.demao_numero IS NULL THEN
    NEW.demao_numero := public.proxima_demao_pintura_v1(NEW.ordem_producao_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_resumo_demaos_pintura_v1()
RETURNS TABLE(
  ordem_producao_id UUID,
  demaos_registradas INTEGER,
  ultima_demao INTEGER,
  proxima_demao INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.id,
    COUNT(DISTINCT a.demao_numero)
      FILTER (WHERE a.status <> 'cancelado' AND a.demao_numero IS NOT NULL)::INTEGER,
    COALESCE(MAX(a.demao_numero)
      FILTER (WHERE a.status <> 'cancelado' AND a.demao_numero IS NOT NULL), 0)::INTEGER,
    public.proxima_demao_pintura_v1(o.id)
  FROM public.producao_ordens_producao o
  LEFT JOIN public.producao_apontamentos a ON a.ordem_producao_id = o.id
  WHERE public.usuario_tem_permissao_producao('visualizar')
    AND public.ordem_producao_e_pintura_v1(o.id)
  GROUP BY o.id
  ORDER BY o.numero;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;