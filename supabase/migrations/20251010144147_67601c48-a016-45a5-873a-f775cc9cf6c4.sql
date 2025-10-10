-- Políticas de acesso ao bucket branding
-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Público pode visualizar logo" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem fazer upload de logo" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem atualizar logo" ON storage.objects;
DROP POLICY IF EXISTS "Apenas admins podem deletar logo" ON storage.objects;

-- Todos podem visualizar
CREATE POLICY "Público pode visualizar logo"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

-- Apenas admins podem fazer upload
CREATE POLICY "Apenas admins podem fazer upload de logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
  AND is_gestor_or_admin()
);

-- Apenas admins podem atualizar
CREATE POLICY "Apenas admins podem atualizar logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
  AND is_gestor_or_admin()
);

-- Apenas admins podem deletar
CREATE POLICY "Apenas admins podem deletar logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'branding' 
  AND auth.role() = 'authenticated'
  AND is_gestor_or_admin()
);