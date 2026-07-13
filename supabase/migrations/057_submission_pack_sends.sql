-- ── 057: Submission pack sends ────────────────────────────────────────────────
-- Append-only record of each time a submission pack email was sent, so the
-- project page can show which builder(s) a pack has been sent to and when.

create table if not exists submission_pack_sends (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  recipient_name  text not null,
  recipient_email text not null,
  cc              text,
  subject         text not null,
  sent_by         uuid not null references profiles(id),
  sent_at         timestamptz not null default now()
);

create index if not exists submission_pack_sends_project_id_idx
  on submission_pack_sends(project_id);

alter table submission_pack_sends enable row level security;

-- Any org member with access to the project can see its send history
drop policy if exists "select_submission_pack_sends" on submission_pack_sends;
create policy "select_submission_pack_sends" on submission_pack_sends for select
  using (
    is_superadmin()
    or user_project_role(project_id) is not null
  );

-- Only the sender (recorded server-side right after a successful send) can insert
drop policy if exists "insert_submission_pack_sends" on submission_pack_sends;
create policy "insert_submission_pack_sends" on submission_pack_sends for insert
  with check (
    sent_by = auth.uid()
    and (
      is_superadmin()
      or user_has_project_write_access(project_id)
    )
  );
