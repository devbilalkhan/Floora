-- ── Project-level manual takeoff rows ────────────────────────────────────────
-- One shared takeoff per project, visible to all project members.
-- Scope category is a group header; finish codes carry spec details.

create table if not exists project_takeoff (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  created_by     uuid not null references profiles(id),
  sort_order     int  not null default 0,
  scope_category text not null check (scope_category in (
                   'vinyl', 'carpet', 'wall_vinyl', 'coving_skirting',
                   'matting', 'stairs', 'transition', 'other'
                 )),
  finish_code    text,
  description    text,
  manufacturer   text,
  colour         text,
  location       text,
  level          text check (level in ('GF', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10')),
  qty            numeric not null default 0,
  unit           text not null default 'm2' check (unit in ('m2', 'lm', 'ea')),
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table project_takeoff enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'project_takeoff' and policyname = 'select_org_takeoff') then
    create policy "select_org_takeoff" on project_takeoff for select using (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_takeoff' and policyname = 'insert_org_takeoff') then
    create policy "insert_org_takeoff" on project_takeoff for insert with check (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_takeoff' and policyname = 'update_org_takeoff') then
    create policy "update_org_takeoff" on project_takeoff for update using (user_has_project_access(project_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'project_takeoff' and policyname = 'delete_org_takeoff') then
    create policy "delete_org_takeoff" on project_takeoff for delete using (user_has_project_access(project_id));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_project_takeoff_updated_at') then
    create trigger trg_project_takeoff_updated_at
      before update on project_takeoff for each row execute function set_updated_at();
  end if;
end $$;
