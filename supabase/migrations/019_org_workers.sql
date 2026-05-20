-- Add org detail fields used in SWMS header
alter table organizations
  add column if not exists org_code  text,
  add column if not exists abn       text,
  add column if not exists address   text,
  add column if not exists phone     text,
  add column if not exists org_email text;

-- Shared team / worker list per org (referenced by SWMS sections 3 & 8)
create table org_workers (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references organizations(id) on delete cascade,
  name       text        not null,
  role       text        not null,
  phone      text,
  email      text,
  sort_order int         not null default 0,
  created_at timestamptz default now()
);

alter table org_workers enable row level security;

create policy "select_org_workers" on org_workers for select
  using (user_has_org_access(org_id));

create policy "insert_org_workers" on org_workers for insert
  with check (user_org_role(org_id) in ('admin', 'project_manager'));

create policy "update_org_workers" on org_workers for update
  using (user_org_role(org_id) in ('admin', 'project_manager'));

create policy "delete_org_workers" on org_workers for delete
  using (user_org_role(org_id) in ('admin', 'project_manager'));
