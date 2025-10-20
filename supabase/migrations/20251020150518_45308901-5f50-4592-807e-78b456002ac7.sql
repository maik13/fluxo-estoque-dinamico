-- Passo 1: Remover foreign keys que referenciam items.id
ALTER TABLE public.movements 
DROP CONSTRAINT IF EXISTS movements_item_id_fkey;

ALTER TABLE public.solicitacao_itens 
DROP CONSTRAINT IF EXISTS solicitacao_itens_item_id_fkey;

-- Passo 2: Remover a chave primária atual da tabela items
ALTER TABLE public.items 
DROP CONSTRAINT IF EXISTS items_pkey;

-- Passo 3: Adicionar constraint UNIQUE em codigo_barras e torná-lo chave primária
ALTER TABLE public.items 
ADD PRIMARY KEY (codigo_barras);

-- Passo 4: Modificar as colunas item_id nas outras tabelas para bigint
ALTER TABLE public.movements 
ALTER COLUMN item_id TYPE bigint USING item_id::text::bigint;

ALTER TABLE public.solicitacao_itens 
ALTER COLUMN item_id TYPE bigint USING item_id::text::bigint;

-- Passo 5: Recriar as foreign keys apontando para codigo_barras
ALTER TABLE public.movements 
ADD CONSTRAINT movements_item_id_fkey 
FOREIGN KEY (item_id) REFERENCES public.items(codigo_barras) ON DELETE CASCADE;

ALTER TABLE public.solicitacao_itens 
ADD CONSTRAINT solicitacao_itens_item_id_fkey 
FOREIGN KEY (item_id) REFERENCES public.items(codigo_barras) ON DELETE CASCADE;

-- Passo 6: Remover a coluna id antiga (agora desnecessária)
ALTER TABLE public.items 
DROP COLUMN IF EXISTS id;