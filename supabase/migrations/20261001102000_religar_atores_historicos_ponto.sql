BEGIN;

UPDATE public.rh_registros_ponto r
SET aprovado_por = m.destino_user_id
FROM public.appcontrole_usuarios_importacao m
WHERE r.origem_aprovado_por = m.source_user_id
  AND m.destino_user_id IS NOT NULL
  AND (r.aprovado_por IS NULL OR r.aprovado_por <> m.destino_user_id);

UPDATE public.rh_registros_ponto r
SET criado_por = m.destino_user_id
FROM public.appcontrole_usuarios_importacao m
WHERE r.origem_created_by = m.source_user_id
  AND m.destino_user_id IS NOT NULL
  AND (r.criado_por IS NULL OR r.criado_por <> m.destino_user_id);

UPDATE public.rh_ponto_dias_pagos d
SET pago_por = m.destino_user_id
FROM public.appcontrole_usuarios_importacao m
WHERE d.origem_pago_por = m.source_user_id
  AND m.destino_user_id IS NOT NULL
  AND (d.pago_por IS NULL OR d.pago_por <> m.destino_user_id);

COMMIT;