DROP POLICY IF EXISTS financeiro_necessidades_almoxarifado_select
ON public.financeiro_necessidades;

DROP POLICY IF EXISTS financeiro_necessidades_almoxarifado_select_todas
ON public.financeiro_necessidades;

CREATE POLICY financeiro_necessidades_almoxarifado_select_todas
ON public.financeiro_necessidades
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles perfil
    WHERE perfil.user_id = auth.uid()
      AND COALESCE(perfil.ativo, true)
      AND perfil.tipo_usuario IN ('administrador', 'estoquista')
  )
);
