-- Remover restrições de chave estrangeira que bloqueiam operações do estoque legado
ALTER TABLE public.producao_materiais_projeto
  DROP CONSTRAINT IF EXISTS producao_materiais_projeto_movement_id_fkey,
  DROP CONSTRAINT IF EXISTS producao_materiais_projeto_projeto_local_id_fkey,
  DROP CONSTRAINT IF EXISTS producao_materiais_projeto_item_id_fkey;

ALTER TABLE public.producao_apontamentos
  DROP CONSTRAINT IF EXISTS producao_apontamentos_projeto_local_id_fkey;

-- Permitir nulidade nas colunas de referência do legado
ALTER TABLE public.producao_materiais_projeto
  ALTER COLUMN movement_id DROP NOT NULL,
  ALTER COLUMN projeto_local_id DROP NOT NULL,
  ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE public.producao_apontamentos
  ALTER COLUMN projeto_local_id DROP NOT NULL;

-- Recriar as chaves estrangeiras com ON DELETE SET NULL para preservar isolamento
ALTER TABLE public.producao_materiais_projeto
  ADD CONSTRAINT producao_materiais_projeto_movement_id_fkey 
  FOREIGN KEY (movement_id) REFERENCES public.movements(id) ON DELETE SET NULL,
  ADD CONSTRAINT producao_materiais_projeto_projeto_local_id_fkey 
  FOREIGN KEY (projeto_local_id) REFERENCES public.locais_utilizacao(id) ON DELETE SET NULL,
  ADD CONSTRAINT producao_materiais_projeto_item_id_fkey 
  FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;

ALTER TABLE public.producao_apontamentos
  ADD CONSTRAINT producao_apontamentos_projeto_local_id_fkey 
  FOREIGN KEY (projeto_local_id) REFERENCES public.locais_utilizacao(id) ON DELETE SET NULL;
