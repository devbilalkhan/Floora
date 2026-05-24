-- ── 037: Project Documents ────────────────────────────────────────────────────
--
-- Stores uploaded PDFs/documents attached to a project (finish schedules, specs
-- etc.). Files live in the existing `drawings` storage bucket under the path:
--   {user_id}/project-docs/{project_id}/{timestamp}-{filename}
--
-- Storage policies on the `drawings` bucket already allow each authenticated
-- user to read/write within their own user-id prefix. Signed URLs for viewing
-- are generated server-side using the service role key (bypasses storage RLS),
-- so all org members can view any document regardless of who uploaded it.

create table if not exists project_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  mime_type    text not null default 'application/pdf',
  size_bytes   bigint,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz default now()
);

alter table project_documents enable row level security;

-- Any org member can read project documents
create policy "select_project_documents" on project_documents for select
  using (
    is_superadmin()
    or user_project_role(project_id) is not null
  );

-- Non-viewers can upload
create policy "insert_project_documents" on project_documents for insert
  with check (
    created_by = auth.uid()
    and (
      is_superadmin()
      or user_has_project_write_access(project_id)
    )
  );

-- Creator or PM+ can delete
create policy "delete_project_documents" on project_documents for delete
  using (
    is_superadmin()
    or created_by = auth.uid()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );
