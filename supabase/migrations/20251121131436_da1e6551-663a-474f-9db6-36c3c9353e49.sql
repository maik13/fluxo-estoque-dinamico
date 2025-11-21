-- Adicionar campo foto_url na tabela items
ALTER TABLE public.items
ADD COLUMN foto_url text;

-- Criar bucket para fotos de produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Criar políticas RLS para o bucket de fotos
CREATE POLICY "Usuários autenticados podem visualizar fotos de produtos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Usuários com permissão podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-photos' AND 
  can_manage_inventory()
);

CREATE POLICY "Usuários com permissão podem atualizar fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-photos' AND 
  can_manage_inventory()
);

CREATE POLICY "Usuários com permissão podem deletar fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-photos' AND 
  can_manage_inventory()
);