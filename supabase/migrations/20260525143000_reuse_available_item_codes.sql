-- Reuse the smallest available positive item code instead of always using max + 1.
CREATE OR REPLACE FUNCTION public.gerar_proximo_codigo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proximo_codigo INTEGER := 1;
BEGIN
  LOOP
    EXIT WHEN proximo_codigo <> 1001
      AND NOT EXISTS (
        SELECT 1
        FROM public.items
        WHERE codigo_barras = proximo_codigo
      );

    proximo_codigo := proximo_codigo + 1;
  END LOOP;

  RETURN proximo_codigo::TEXT;
END;
$$;
