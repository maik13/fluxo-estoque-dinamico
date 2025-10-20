-- Reverter para UUID como chave primária

-- Passo 1: Remover foreign keys
ALTER TABLE public.movements 
DROP CONSTRAINT IF EXISTS movements_item_id_fkey;

ALTER TABLE public.solicitacao_itens 
DROP CONSTRAINT IF EXISTS solicitacao_itens_item_id_fkey;

-- Passo 2: Remover chave primária atual (codigo_barras)
ALTER TABLE public.items 
DROP CONSTRAINT IF EXISTS items_pkey;

-- Passo 3: Adicionar coluna id UUID de volta
ALTER TABLE public.items 
ADD COLUMN id UUID DEFAULT gen_random_uuid();

-- Passo 4: Definir id como chave primária
ALTER TABLE public.items 
ADD PRIMARY KEY (id);

-- Passo 5: Reverter codigo_barras para TEXT
ALTER TABLE public.items 
ALTER COLUMN codigo_barras TYPE text USING codigo_barras::text;

-- Passo 6: Alterar item_id nas outras tabelas de bigint para uuid
-- Como as tabelas estão vazias, podemos fazer a conversão direta
ALTER TABLE public.movements 
ALTER COLUMN item_id TYPE uuid USING NULL; -- Força NULL pois não há dados

ALTER TABLE public.solicitacao_itens 
ALTER COLUMN item_id TYPE uuid USING NULL; -- Força NULL pois não há dados

-- Passo 7: Recriar foreign keys referenciando items.id
ALTER TABLE public.movements 
ADD CONSTRAINT movements_item_id_fkey 
FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE public.solicitacao_itens 
ADD CONSTRAINT solicitacao_itens_item_id_fkey 
FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;