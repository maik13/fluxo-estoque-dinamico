-- Migration: Fix categoria_id trigger in items
-- Date: 2026-04-20

-- Refatorar a função para ser mais robusta na atualização automática da categoria
CREATE OR REPLACE FUNCTION public.fill_item_categoria_id()
RETURNS TRIGGER AS $$
DECLARE
    found_categoria_id UUID;
BEGIN
    -- Se é um novo item, ou a subcategoria mudou, ou a categoria_id está nula
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.subcategoria_id IS DISTINCT FROM NEW.subcategoria_id) OR NEW.categoria_id IS NULL) THEN
        
        -- Se existe uma subcategoria selecionada
        IF NEW.subcategoria_id IS NOT NULL THEN
            -- Verifica se a categoria_id atual (se houver) é válida para esta subcategoria
            SELECT categoria_id INTO found_categoria_id
            FROM public.categoria_subcategoria
            WHERE subcategoria_id = NEW.subcategoria_id AND categoria_id = NEW.categoria_id
            LIMIT 1;
            
            -- Se a categoria atual NÃO for válida para a nova subcategoria, 
            -- ou se NEW.categoria_id for nulo, buscamos a categoria padrão (vínculo mais antigo)
            IF found_categoria_id IS NULL THEN
                SELECT categoria_id INTO NEW.categoria_id
                FROM public.categoria_subcategoria
                WHERE subcategoria_id = NEW.subcategoria_id
                ORDER BY created_at ASC
                LIMIT 1;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Garantir que o trigger está aplicado corretamente (re-criando apenas por segurança se necessário, 
-- embora o trigger original já aponte para esta função pelo nome)
-- DROP TRIGGER IF EXISTS trg_fill_item_categoria_id ON public.items;
-- CREATE TRIGGER trg_fill_item_categoria_id
-- BEFORE INSERT OR UPDATE OF subcategoria_id, categoria_id ON public.items
-- FOR EACH ROW
-- EXECUTE FUNCTION public.fill_item_categoria_id();
