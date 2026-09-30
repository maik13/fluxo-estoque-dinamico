BEGIN;

ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS origem_user_id uuid NULL;

ALTER TABLE public.rh_registros_ponto
  ADD COLUMN IF NOT EXISTS origem_created_by uuid NULL,
  ADD COLUMN IF NOT EXISTS origem_aprovado_por uuid NULL;

ALTER TABLE public.rh_ponto_dias_pagos
  ADD COLUMN IF NOT EXISTS origem_pago_por uuid NULL;

COMMENT ON COLUMN public.rh_colaboradores.origem_user_id IS
  'UUID do usuário no sistema de origem; não é FK do Auth atual.';
COMMENT ON COLUMN public.rh_registros_ponto.origem_created_by IS
  'UUID histórico de created_by no sistema de origem.';
COMMENT ON COLUMN public.rh_registros_ponto.origem_aprovado_por IS
  'UUID histórico de aprovado_por no sistema de origem.';
COMMENT ON COLUMN public.rh_ponto_dias_pagos.origem_pago_por IS
  'UUID histórico de pago_por no sistema de origem.';

COMMIT;

NOTIFY pgrst, 'reload schema';
