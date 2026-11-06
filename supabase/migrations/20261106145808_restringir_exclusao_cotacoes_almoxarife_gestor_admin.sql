BEGIN;

DROP POLICY IF EXISTS cotacoes_delete ON public.cotacoes;
CREATE POLICY cotacoes_delete
ON public.cotacoes
FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = (SELECT auth.uid())
      AND p.ativo = true
      AND p.tipo_usuario IN ('gestor', 'estoquista')
  )
);

COMMENT ON POLICY cotacoes_delete ON public.cotacoes IS
  'Exclusão permitida somente para administrador, gestor ou almoxarife/estoquista.';

COMMIT;
