-- Modificar tipo de dado da coluna codigo_barras para bigint
ALTER TABLE public.items 
ALTER COLUMN codigo_barras TYPE bigint USING codigo_barras::bigint;