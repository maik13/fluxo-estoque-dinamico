BEGIN;

UPDATE public.items
SET
  tipo_item = 'Insumo',
  categoria_id = 'a4999db1-71c5-4b46-920f-d92670208253'::uuid,
  subcategoria_id = 'd0ab2cc6-e101-4ec6-8109-88c5ff858035'::uuid,
  updated_at = now()
WHERE codigo_barras = 1792
  AND ativo = true;

COMMIT;