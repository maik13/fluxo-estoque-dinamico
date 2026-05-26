ALTER TABLE public.solicitacoes_material
DROP CONSTRAINT IF EXISTS solicitacoes_material_local_origem_required;

ALTER TABLE public.solicitacoes_material
ADD CONSTRAINT solicitacoes_material_local_origem_required
CHECK (
  local_origem_id IS NOT NULL
  AND NULLIF(BTRIM(local_origem), '') IS NOT NULL
) NOT VALID;
