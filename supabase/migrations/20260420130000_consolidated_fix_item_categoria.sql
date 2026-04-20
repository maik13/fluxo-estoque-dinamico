-- 1. Adicionar a coluna categoria_id se ela não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'items' AND COLUMN_NAME = 'categoria_id') THEN
        ALTER TABLE public.items ADD COLUMN categoria_id UUID REFERENCES public.categorias(id);
    END IF;
END $$;

-- 2. Migrar dados existentes (associar categoria atual baseada na subcategoria vinculada)
UPDATE public.items i
SET categoria_id = (
    SELECT cs.categoria_id 
    FROM public.categoria_subcategoria cs 
    WHERE cs.subcategoria_id = i.subcategoria_id 
    LIMIT 1
)
WHERE i.categoria_id IS NULL AND i.subcategoria_id IS NOT NULL;

-- 3. Função para manter a consistência entre subcategoria e categoria
CREATE OR REPLACE FUNCTION public.fill_item_categoria_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a subcategoria mudou ou foi preenchida agora
    IF (TG_OP = 'INSERT' AND NEW.subcategoria_id IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND (OLD.subcategoria_id IS DISTINCT FROM NEW.subcategoria_id OR NEW.categoria_id IS NULL)) THEN
        
        -- Garante que se o categoria_id não foi enviado mas a subcategoria existe, preenchemos automaticamente
        IF (NEW.subcategoria_id IS NOT NULL) THEN
            SELECT cs.categoria_id INTO NEW.categoria_id
            FROM public.categoria_subcategoria cs
            WHERE cs.subcategoria_id = NEW.subcategoria_id
            LIMIT 1;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar o trigger
DROP TRIGGER IF EXISTS trigger_fill_item_categoria_id ON public.items;
CREATE TRIGGER trigger_fill_item_categoria_id
BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.fill_item_categoria_id();
