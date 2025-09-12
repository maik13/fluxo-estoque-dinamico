-- Create branding storage bucket (public) if not exists
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Storage policies for branding bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read access to branding'
  ) THEN
    CREATE POLICY "Public read access to branding"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'branding');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can upload to branding'
  ) THEN
    CREATE POLICY "Managers can upload to branding"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'branding' AND public.can_manage_inventory());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can update branding'
  ) THEN
    CREATE POLICY "Managers can update branding"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'branding' AND public.can_manage_inventory());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Managers can delete branding'
  ) THEN
    CREATE POLICY "Managers can delete branding"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'branding' AND public.can_manage_inventory());
  END IF;
END $$;

-- Add local_utilizacao column to movements table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'movements' AND column_name = 'local_utilizacao'
  ) THEN
    ALTER TABLE public.movements ADD COLUMN local_utilizacao text;
  END IF;
END $$;