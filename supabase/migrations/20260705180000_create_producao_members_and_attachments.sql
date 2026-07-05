-- Equipe própria e anexos do Módulo de Produção.
-- Não altera solicitantes, estoque, items ou movements.

CREATE TABLE IF NOT EXISTS public.producao_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  apelido TEXT NULL,
  funcao TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_membros_nome_nao_vazio CHECK (btrim(nome) <> '')
);

DROP TRIGGER IF EXISTS update_producao_membros_updated_at
  ON public.producao_membros;
CREATE TRIGGER update_producao_membros_updated_at
  BEFORE UPDATE ON public.producao_membros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.producao_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar membros da produção"
  ON public.producao_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem criar membros da produção"
  ON public.producao_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar membros da produção"
  ON public.producao_membros;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir membros da produção"
  ON public.producao_membros;

CREATE POLICY "Usuários autenticados podem visualizar membros da produção"
  ON public.producao_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar membros da produção"
  ON public.producao_membros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar membros da produção"
  ON public.producao_membros FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir membros da produção"
  ON public.producao_membros FOR DELETE TO authenticated USING (true);

ALTER TABLE public.producao_apontamento_membros
  ADD COLUMN IF NOT EXISTS membro_id UUID NULL;

-- Converte vínculos legados sem modificar public.solicitantes.
DO $$
DECLARE
  origem RECORD;
  novo_membro_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'producao_apontamento_membros'
      AND column_name = 'solicitante_id'
  ) THEN
    FOR origem IN EXECUTE
      'SELECT solicitante_id, min(nome_snapshot) AS nome_snapshot
       FROM public.producao_apontamento_membros
       GROUP BY solicitante_id'
    LOOP
      INSERT INTO public.producao_membros (nome)
      VALUES (origem.nome_snapshot)
      RETURNING id INTO novo_membro_id;

      EXECUTE
        'UPDATE public.producao_apontamento_membros
         SET membro_id = $1
         WHERE solicitante_id = $2'
      USING novo_membro_id, origem.solicitante_id;
    END LOOP;
  END IF;
END
$$;

ALTER TABLE public.producao_apontamento_membros
  DROP CONSTRAINT IF EXISTS producao_apontamento_membros_solicitante_id_fkey,
  DROP CONSTRAINT IF EXISTS producao_apontamento_membros_unicos;

DROP INDEX IF EXISTS public.producao_apontamento_membros_solicitante_id_idx;

ALTER TABLE public.producao_apontamento_membros
  DROP COLUMN IF EXISTS solicitante_id,
  ALTER COLUMN membro_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'producao_apontamento_membros_membro_id_fkey'
      AND conrelid = 'public.producao_apontamento_membros'::regclass
  ) THEN
    ALTER TABLE public.producao_apontamento_membros
      ADD CONSTRAINT producao_apontamento_membros_membro_id_fkey
      FOREIGN KEY (membro_id) REFERENCES public.producao_membros(id);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS producao_apontamento_membros_apontamento_membro_unique
  ON public.producao_apontamento_membros (apontamento_id, membro_id);
CREATE INDEX IF NOT EXISTS producao_apontamento_membros_membro_id_idx
  ON public.producao_apontamento_membros (membro_id);

CREATE TABLE IF NOT EXISTS public.producao_apontamento_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apontamento_id UUID NOT NULL
    REFERENCES public.producao_apontamentos(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NULL,
  uploaded_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT producao_apontamento_anexos_mime_type_valido
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT producao_apontamento_anexos_size_valido
    CHECK (size_bytes IS NULL OR size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS producao_apontamento_anexos_apontamento_id_idx
  ON public.producao_apontamento_anexos (apontamento_id);
CREATE INDEX IF NOT EXISTS producao_apontamento_anexos_uploaded_by_idx
  ON public.producao_apontamento_anexos (uploaded_by);

ALTER TABLE public.producao_apontamento_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar anexos da produção"
  ON public.producao_apontamento_anexos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar anexos da produção"
  ON public.producao_apontamento_anexos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar anexos da produção"
  ON public.producao_apontamento_anexos;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir anexos da produção"
  ON public.producao_apontamento_anexos;

CREATE POLICY "Usuários autenticados podem visualizar anexos da produção"
  ON public.producao_apontamento_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar anexos da produção"
  ON public.producao_apontamento_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem atualizar anexos da produção"
  ON public.producao_apontamento_anexos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem excluir anexos da produção"
  ON public.producao_apontamento_anexos FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'producao-apontamentos',
  'producao-apontamentos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Usuários autenticados podem visualizar imagens da produção"
  ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem enviar imagens da produção"
  ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir imagens da produção"
  ON storage.objects;

CREATE POLICY "Usuários autenticados podem visualizar imagens da produção"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'producao-apontamentos');
CREATE POLICY "Usuários autenticados podem enviar imagens da produção"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'producao-apontamentos');
CREATE POLICY "Usuários autenticados podem excluir imagens da produção"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'producao-apontamentos');
