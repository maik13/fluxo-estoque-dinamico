-- Storage policies for branding bucket
-- Allow public read
create policy if not exists "Public read branding bucket"
  on storage.objects for select
  using (bucket_id = 'branding');

-- Allow authenticated users to upload/update branding objects
create policy if not exists "Authenticated can upload branding"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'branding');

create policy if not exists "Authenticated can update branding"
  on storage.objects for update to authenticated
  using (bucket_id = 'branding')
  with check (bucket_id = 'branding');

-- Only admins can delete branding objects
create policy if not exists "Admins can delete branding"
  on storage.objects for delete to authenticated
  using (is_admin());