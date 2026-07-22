-- Restaura o fluxo seguro de anexos no Módulo de Produção.
-- O upload do arquivo continua no bucket privado; o registro e a exclusão dos
-- metadados passam por RPCs auditáveis porque as tabelas producao_* não aceitam
-- escrita direta do navegador.
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_anexo_producao(
  p_apontamento_id UUID,
  p_file_path TEXT,
  p_file_name TEXT,
  p_mime_type TEXT,
  p_size_bytes BIGINT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
  v_status TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('anexos') THEN
    RAISE EXCEPTION 'Sem permissão para anexar imagens';
  END IF;

  SELECT status INTO v_status
  FROM public.producao_apontamentos
  WHERE id = p_apontamento_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Apontamento não encontrado'; END IF;
  IF v_status <> 'lancado' THEN
    RAISE EXCEPTION 'Fotos somente podem ser adicionadas enquanto o apontamento estiver pendente';
  END IF;
  IF p_mime_type NOT IN ('image/jpeg','image/png','image/webp') THEN
    RAISE EXCEPTION 'Formato de imagem não permitido';
  END IF;
  IF p_size_bytes IS NULL OR p_size_bytes <= 0 OR p_size_bytes > 10485760 THEN
    RAISE EXCEPTION 'A imagem deve possuir até 10 MB';
  END IF;
  IF btrim(COALESCE(p_file_path,'')) = '' OR btrim(COALESCE(p_file_name,'')) = '' THEN
    RAISE EXCEPTION 'Arquivo inválido';
  END IF;
  IF split_part(p_file_path, '/', 1) <> p_apontamento_id::TEXT THEN
    RAISE EXCEPTION 'Caminho do arquivo incompatível com o apontamento';
  END IF;

  INSERT INTO public.producao_apontamento_anexos(
    apontamento_id, file_path, file_name, mime_type, size_bytes, uploaded_by
  ) VALUES (
    p_apontamento_id, p_file_path, btrim(p_file_name), p_mime_type,
    p_size_bytes, v_user
  ) RETURNING id INTO v_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_novo
  )
  SELECT p_apontamento_id, 'anexo_adicionado', v_user,
    COALESCE(raw_user_meta_data->>'name', email, 'Usuário'),
    jsonb_build_object('anexo_id', v_id, 'file_name', btrim(p_file_name))::TEXT
  FROM auth.users WHERE id = v_user;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_anexo_producao(
  p_anexo_id UUID
) RETURNS TABLE(file_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_apontamento UUID;
  v_path TEXT;
  v_status TEXT;
  v_nome TEXT;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('anexos') THEN
    RAISE EXCEPTION 'Sem permissão para remover imagens';
  END IF;

  SELECT a.apontamento_id, a.file_path, ap.status
  INTO v_apontamento, v_path, v_status
  FROM public.producao_apontamento_anexos a
  JOIN public.producao_apontamentos ap ON ap.id = a.apontamento_id
  WHERE a.id = p_anexo_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN RAISE EXCEPTION 'Anexo não encontrado'; END IF;
  IF v_status <> 'lancado' THEN
    RAISE EXCEPTION 'Fotos somente podem ser removidas enquanto o apontamento estiver pendente';
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário')
  INTO v_nome FROM auth.users WHERE id = v_user;

  DELETE FROM public.producao_apontamento_anexos WHERE id = p_anexo_id;

  INSERT INTO public.producao_apontamento_eventos(
    apontamento_id, evento, usuario_id, nome_usuario_snapshot, valor_anterior
  ) VALUES (
    v_apontamento, 'anexo_removido', v_user, v_nome,
    jsonb_build_object('anexo_id', p_anexo_id, 'file_path', v_path)::TEXT
  );

  RETURN QUERY SELECT v_path;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_anexo_producao(UUID,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_anexo_producao(UUID,TEXT,TEXT,TEXT,BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.remover_anexo_producao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remover_anexo_producao(UUID) TO authenticated;

-- Storage permanece privado e restrito à pasta cujo primeiro segmento é um
-- apontamento existente. A autorização funcional final continua nas RPCs.
DROP POLICY IF EXISTS producao_storage_ler ON storage.objects;
DROP POLICY IF EXISTS producao_storage_inserir ON storage.objects;
DROP POLICY IF EXISTS producao_storage_excluir ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar imagens da produção" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem enviar imagens da produção" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir imagens da produção" ON storage.objects;

CREATE POLICY producao_storage_ler
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('visualizar')
);

CREATE POLICY producao_storage_inserir
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('anexos')
  AND EXISTS (
    SELECT 1 FROM public.producao_apontamentos ap
    WHERE ap.id::TEXT = (storage.foldername(name))[1]
      AND ap.status = 'lancado'
  )
);

CREATE POLICY producao_storage_excluir
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'producao-apontamentos'
  AND public.usuario_tem_permissao_producao('anexos')
);

COMMIT;
