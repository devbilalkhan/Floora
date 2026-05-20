-- ── Enums ──────────────────────────────────────────────────────────────────────

create type task_status   as enum ('todo', 'in_progress', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');

-- ── Tasks table ────────────────────────────────────────────────────────────────

create table tasks (
  id           uuid           primary key default gen_random_uuid(),
  org_id       uuid           not null references organizations(id) on delete cascade,
  project_id   uuid           references projects(id) on delete set null,
  title        text           not null check (char_length(trim(title)) > 0),
  tags         text[]         not null default '{}',
  status       task_status    not null default 'todo',
  priority     task_priority  not null default 'medium',
  due_date     date,
  assigned_to  uuid           references profiles(id) on delete set null,
  created_by   uuid           not null references profiles(id),
  created_at   timestamptz    default now(),
  updated_at   timestamptz    default now()
);

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table tasks enable row level security;

create policy "select_org_tasks" on tasks for select
  using (user_has_org_access(org_id));

create policy "insert_org_tasks" on tasks for insert
  with check (user_has_org_access(org_id) and created_by = auth.uid());

create policy "update_org_tasks" on tasks for update
  using (user_has_org_access(org_id));

create policy "delete_org_tasks" on tasks for delete
  using (user_has_org_access(org_id));

-- ── Allow org members to see each other's profiles (for assignee names) ────────

drop policy if exists "select_own_profile" on profiles;

create policy "select_profiles" on profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from organization_members om1
      join organization_members om2 on om2.organization_id = om1.organization_id
      where om1.user_id = auth.uid() and om2.user_id = profiles.id
    )
  );

-- ── Trigger ────────────────────────────────────────────────────────────────────

create trigger trg_tasks_updated_at
  before update on tasks for each row execute function set_updated_at();
