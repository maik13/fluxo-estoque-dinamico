-- Criar tabela de categorias
CREATE TABLE IF NOT EXISTS public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de relacionamento muitos-para-muitos
CREATE TABLE IF NOT EXISTS public.categoria_subcategoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  subcategoria_id UUID NOT NULL REFERENCES public.subcategorias(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(categoria_id, subcategoria_id)
);

-- Migrar dados existentes
-- 1. Inserir categorias únicas da tabela subcategorias
INSERT INTO public.categorias (nome, ativo)
SELECT DISTINCT categoria, true
FROM public.subcategorias
WHERE categoria IS NOT NULL AND categoria != ''
ON CONFLICT (nome) DO NOTHING;

-- 2. Criar relacionamentos para dados existentes
INSERT INTO public.categoria_subcategoria (categoria_id, subcategoria_id)
SELECT c.id, s.id
FROM public.subcategorias s
JOIN public.categorias c ON c.nome = s.categoria
WHERE s.categoria IS NOT NULL AND s.categoria != ''
ON CONFLICT (categoria_id, subcategoria_id) DO NOTHING;

-- Remover coluna categoria da tabela subcategorias (agora obsoleta)
ALTER TABLE public.subcategorias DROP COLUMN IF EXISTS categoria;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_subcategoria ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para categorias
CREATE POLICY "Usuários autenticados podem visualizar categorias"
ON public.categorias FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores e admins podem criar categorias"
ON public.categorias FOR INSERT
TO authenticated
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores e admins podem atualizar categorias"
ON public.categorias FOR UPDATE
TO authenticated
USING (can_manage_inventory());

CREATE POLICY "Gestores e admins podem deletar categorias"
ON public.categorias FOR DELETE
TO authenticated
USING (can_manage_inventory());

-- Políticas RLS para relacionamentos categoria-subcategoria
CREATE POLICY "Usuários autenticados podem visualizar relacionamentos"
ON public.categoria_subcategoria FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Gestores e admins podem criar relacionamentos"
ON public.categoria_subcategoria FOR INSERT
TO authenticated
WITH CHECK (can_manage_inventory());

CREATE POLICY "Gestores e admins podem deletar relacionamentos"
ON public.categoria_subcategoria FOR DELETE
TO authenticated
USING (can_manage_inventory());

-- Trigger para updated_at em categorias
CREATE TRIGGER update_categorias_updated_at
BEFORE UPDATE ON public.categorias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();