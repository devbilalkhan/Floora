-- Add logo_url to organizations
alter table organizations
  add column if not exists logo_url text;

-- Create public storage bucket for org logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
)
on conflict (id) do nothing;

-- Only org admins may upload/replace their org logo
-- Path pattern: {orgId}/logo.{ext}
create policy "org_admin_upload_logo" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'org-logos'
    and (select user_org_role((split_part(name, '/', 1))::uuid)) = 'admin'
  );

create policy "org_admin_update_logo" on storage.objects
  for update to authenticated using (
    bucket_id = 'org-logos'
    and (select user_org_role((split_part(name, '/', 1))::uuid)) = 'admin'
  );

create policy "org_admin_delete_logo" on storage.objects
  for delete to authenticated using (
    bucket_id = 'org-logos'
    and (select user_org_role((split_part(name, '/', 1))::uuid)) = 'admin'
  );

-- Public read (bucket is already public; explicit policy for completeness)
create policy "public_read_org_logos" on storage.objects
  for select using (bucket_id = 'org-logos');
