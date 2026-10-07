BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_corrigir_locais_natal2026_20261007;

CREATE TABLE IF NOT EXISTS backup_corrigir_locais_natal2026_20261007.locais_utilizacao
AS
SELECT *
FROM public.locais_utilizacao
WHERE id IN (
  'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
  '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
  '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
);

CREATE TABLE IF NOT EXISTS backup_corrigir_locais_natal2026_20261007.solicitacoes_material
AS
SELECT *
FROM public.solicitacoes_material
WHERE local_origem_id IN (
  'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
  '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
  '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
);

CREATE TABLE IF NOT EXISTS backup_corrigir_locais_natal2026_20261007.project_groups
AS
SELECT *
FROM public.project_groups
WHERE id='b06937eb-2c96-4af3-8651-11b10bdddabf'::uuid;

UPDATE public.locais_utilizacao
SET nome = CASE id
  WHEN 'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid THEN 'Materiais gerais · Brusque'
  WHEN '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid THEN 'Materiais gerais · Rolândia'
  WHEN '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid THEN 'Materiais gerais · Pq do Japão (Mga)'
  ELSE nome
END,
updated_at=now()
WHERE id IN (
  'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
  '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
  '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
);

UPDATE public.solicitacoes_material sm
SET local_origem = l.nome,
    updated_at = now()
FROM public.locais_utilizacao l
WHERE sm.local_origem_id=l.id
  AND l.id IN (
    'd0c0b683-39d6-479b-b0e1-a4f5ef302ea0'::uuid,
    '171bcfe5-e18f-424d-9f01-7795edab780a'::uuid,
    '83de8922-f069-4690-8662-449e4dbc4fc0'::uuid
  );

DELETE FROM public.project_groups
WHERE id='b06937eb-2c96-4af3-8651-11b10bdddabf'::uuid;

COMMIT;