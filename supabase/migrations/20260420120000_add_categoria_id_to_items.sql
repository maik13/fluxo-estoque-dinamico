-- Migration: Add categoria_id to items and ensure consistency
-- Date: 2026-04-20

-- 1. Add categoria_id column
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categorias(id);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_items_categoria_id ON public.items(categoria_id);

-- 3. Populate existing data
-- Automatically fill categoria_id based on the first link between subcategory and category
UPDATE public.items i
SET categoria_id = (
  SELECT cs.categoria_id
  FROM public.categoria_subcategoria cs
  WHERE cs.subcategoria_id = i.subcategoria_id
  ORDER BY cs.created_at ASC
  LIMIT 1
)
WHERE i.categoria_id IS NULL 
AND i.subcategoria_id IS NOT NULL;

-- 4. Create trigger function for automatic consistency
CREATE OR REPLACE FUNCTION public.fill_item_categoria_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If subcategoria_id is provided but categoria_id is not, fill it automatically
  IF NEW.categoria_id IS NULL AND NEW.subcategoria_id IS NOT NULL THEN
    SELECT categoria_id INTO NEW.categoria_id
    FROM public.categoria_subcategoria
    WHERE subcategoria_id = NEW.subcategoria_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS trg_fill_item_categoria_id ON public.items;
CREATE TRIGGER trg_fill_item_categoria_id
BEFORE INSERT OR UPDATE OF subcategoria_id, categoria_id ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.fill_item_categoria_id();

-- 6. Comment for documentation
COMMENT ON COLUMN public.items.categoria_id IS 'ID da categoria vinculada diretamente ao item. Preenchido automaticamente via trigger se omitido mas subcategoria_id estiver presente.';
