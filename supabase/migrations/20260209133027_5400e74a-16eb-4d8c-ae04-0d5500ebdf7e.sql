
-- Add edit tracking fields to pedidos_compra
ALTER TABLE public.pedidos_compra
ADD COLUMN editado boolean NOT NULL DEFAULT false,
ADD COLUMN editado_por text,
ADD COLUMN editado_em timestamp with time zone;
