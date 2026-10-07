BEGIN;

UPDATE public.locais_utilizacao
SET nome='Natal 2026',
    updated_at=now()
WHERE id IN (
  'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
  '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
  '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
);

UPDATE public.solicitacoes_material
SET local_origem='Natal 2026',
    updated_at=now()
WHERE numero=73
  AND local_origem_id='83de8922-f069-4690-8662-449e4dbc4fc0'::uuid;

COMMIT;