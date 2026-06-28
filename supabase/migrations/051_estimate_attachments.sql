-- ── 051: Estimate Attachments ─────────────────────────────────────────────────
--
-- Files attached to a specific estimate (PDFs, Excel, images, etc.).
-- Stored in the existing `project-documents` bucket under:
--   estimate-attachments/{estimate_id}/{timestamp}-{filename}

create table if not exists estimate_attachments (
  id           uuid primary key default gen_random_uuid(),
  estimate_id  uuid not null references estimates(id) on delete cascade,
  project_id   uuid not null references projects(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  mime_type    text not null default 'application/pdf',
  size_bytes   bigint,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz default now()
);

alter table estimate_attachments enable row level security;

drop policy if exists "select_estimate_attachments" on estimate_attachments;
create policy "select_estimate_attachments" on estimate_attachments for select
  using (
    is_superadmin()
    or user_project_role(project_id) is not null
  );

drop policy if exists "insert_estimate_attachments" on estimate_attachments;
create policy "insert_estimate_attachments" on estimate_attachments for insert
  with check (
    created_by = auth.uid()
    and (
      is_superadmin()
      or user_has_project_write_access(project_id)
    )
  );

drop policy if exists "delete_estimate_attachments" on estimate_attachments;
create policy "delete_estimate_attachments" on estimate_attachments for delete
  using (
    is_superadmin()
    or created_by = auth.uid()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );
