-- Adicionar colunas de local de origem em solicitacoes_material
ALTER TABLE public.solicitacoes_material ADD COLUMN IF NOT EXISTS local_origem_id uuid REFERENCES public.locais_utilizacao(id) ON DELETE SET NULL;
ALTER TABLE public.solicitacoes_material ADD COLUMN IF NOT EXISTS local_origem text;
