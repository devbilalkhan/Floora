-- ── Named takeoff containers ───────────────────────────────────────────────────
-- A project can have multiple takeoffs (e.g. one per school in a multi-site contract).
-- project_takeoff rows now belong to a takeoff, not directly to a project.

create table if not exists takeoffs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_by  uuid not null references profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table takeoffs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'takeoffs' and policyname = 'select_takeoffs') then
    create policy "select_takeoffs" on takeoffs for select using (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'takeoffs' and policyname = 'insert_takeoffs') then
    create policy "insert_takeoffs" on takeoffs for insert with check (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'takeoffs' and policyname = 'update_takeoffs') then
    create policy "update_takeoffs" on takeoffs for update using (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'takeoffs' and policyname = 'delete_takeoffs') then
    create policy "delete_takeoffs" on takeoffs for delete using (user_has_project_access(project_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_takeoffs_updated_at') then
    create trigger trg_takeoffs_updated_at
      before update on takeoffs for each row execute function set_updated_at();
  end if;
end $$;

-- ── Migrate project_takeoff to reference takeoffs ──────────────────────────────

-- Drop old policies first (they reference project_id, which we're about to remove)
drop policy if exists "select_org_takeoff" on project_takeoff;
drop policy if exists "insert_org_takeoff" on project_takeoff;
drop policy if exists "update_org_takeoff" on project_takeoff;
drop policy if exists "delete_org_takeoff" on project_takeoff;

-- Add takeoff_id (nullable during migration)
alter table project_takeoff
  add column if not exists takeoff_id uuid references takeoffs(id) on delete cascade;

-- Test mode: no live rows to migrate — drop project_id and make takeoff_id required
alter table project_takeoff drop column if exists project_id;
alter table project_takeoff alter column takeoff_id set not null;

create policy "select_org_takeoff" on project_takeoff for select
  using (exists (
    select 1 from takeoffs t where t.id = takeoff_id and user_has_project_access(t.project_id)
  ));
create policy "insert_org_takeoff" on project_takeoff for insert
  with check (exists (
    select 1 from takeoffs t where t.id = takeoff_id and user_has_project_access(t.project_id)
  ));
create policy "update_org_takeoff" on project_takeoff for update
  using (exists (
    select 1 from takeoffs t where t.id = takeoff_id and user_has_project_access(t.project_id)
  ));
create policy "delete_org_takeoff" on project_takeoff for delete
  using (exists (
    select 1 from takeoffs t where t.id = takeoff_id and user_has_project_access(t.project_id)
  ));

-- Fix: add blm to unit check (was missing from 005)
alter table project_takeoff drop constraint if exists project_takeoff_unit_check;
alter table project_takeoff
  add constraint project_takeoff_unit_check check (unit in ('m2', 'lm', 'blm', 'ea'));
