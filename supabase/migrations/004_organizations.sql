-- ── Role enum ─────────────────────────────────────────────────────────────────

create type org_role as enum ('admin', 'project_manager', 'estimator');

-- ── Tables first ──────────────────────────────────────────────────────────────

create table organizations (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        not null unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table organization_members (
  organization_id uuid      not null references organizations(id) on delete cascade,
  user_id         uuid      not null references profiles(id) on delete cascade,
  role            org_role  not null default 'estimator',
  invited_by      uuid      references profiles(id),
  joined_at       timestamptz default now(),
  primary key (organization_id, user_id)
);

-- ── Alter projects before functions reference it ───────────────────────────────

alter table projects
  add column organization_id uuid references organizations(id) on delete cascade;

alter table projects rename column owner_id to created_by;

-- ── Access helpers (security definer bypasses RLS in policy subqueries) ────────

create or replace function user_has_org_access(org_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  )
$$;

create or replace function user_org_role(org_id uuid)
returns text language sql security definer stable as $$
  select role::text from organization_members
  where organization_id = org_id and user_id = auth.uid()
  limit 1
$$;

create or replace function user_has_project_access(proj_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from projects p
    join organization_members om on om.organization_id = p.organization_id
    where p.id = proj_id and om.user_id = auth.uid()
  )
$$;

create or replace function user_has_drawing_access(draw_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from drawings d
    join projects p on p.id = d.project_id
    join organization_members om on om.organization_id = p.organization_id
    where d.id = draw_id and om.user_id = auth.uid()
  )
$$;

create or replace function user_has_page_access(page_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from drawing_pages dp
    join drawings d on d.id = dp.drawing_id
    join projects p on p.id = d.project_id
    join organization_members om on om.organization_id = p.organization_id
    where dp.id = page_id and om.user_id = auth.uid()
  )
$$;

-- ── Organizations RLS ──────────────────────────────────────────────────────────

alter table organizations enable row level security;

create policy "select_member_org" on organizations for select
  using (user_has_org_access(id));

create policy "insert_org" on organizations for insert
  with check (auth.uid() is not null);

create policy "update_org" on organizations for update
  using (user_org_role(id) = 'admin');

-- ── Organization Members RLS ───────────────────────────────────────────────────

alter table organization_members enable row level security;

create policy "select_org_members" on organization_members for select
  using (user_has_org_access(organization_id));

create policy "insert_org_members" on organization_members for insert
  with check (
    user_org_role(organization_id) = 'admin'
    or not exists (
      select 1 from organization_members e
      where e.organization_id = organization_members.organization_id
    )
  );

create policy "update_org_members" on organization_members for update
  using (user_org_role(organization_id) = 'admin');

create policy "delete_org_members" on organization_members for delete
  using (user_org_role(organization_id) = 'admin');

-- ── Projects RLS ──────────────────────────────────────────────────────────────

drop policy "select_own_projects" on projects;
drop policy "insert_own_projects" on projects;
drop policy "update_own_projects" on projects;
drop policy "delete_own_projects" on projects;

create policy "select_org_projects" on projects for select
  using (user_has_org_access(organization_id));

create policy "insert_org_projects" on projects for insert
  with check (user_org_role(organization_id) in ('admin', 'project_manager'));

create policy "update_org_projects" on projects for update
  using (user_org_role(organization_id) in ('admin', 'project_manager'));

create policy "delete_org_projects" on projects for delete
  using (user_org_role(organization_id) = 'admin');

-- ── Drawings RLS (conditional — table created in migration 002) ───────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'drawings') then
    drop policy if exists "select_own_drawings" on drawings;
    drop policy if exists "insert_own_drawings" on drawings;
    drop policy if exists "update_own_drawings" on drawings;
    drop policy if exists "delete_own_drawings" on drawings;

    execute 'create policy "select_org_drawings" on drawings for select using (user_has_project_access(project_id))';
    execute 'create policy "insert_org_drawings" on drawings for insert with check (user_has_project_access(project_id))';
    execute 'create policy "update_org_drawings" on drawings for update using (user_has_project_access(project_id))';
    execute 'create policy "delete_org_drawings" on drawings for delete using (user_has_project_access(project_id))';
  end if;
end $$;

-- ── Drawing Pages RLS (conditional — table created in migration 002) ──────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'drawing_pages') then
    drop policy if exists "select_own_pages" on drawing_pages;
    drop policy if exists "insert_own_pages" on drawing_pages;
    drop policy if exists "update_own_pages" on drawing_pages;
    drop policy if exists "delete_own_pages" on drawing_pages;

    execute 'create policy "select_org_pages" on drawing_pages for select using (user_has_drawing_access(drawing_id))';
    execute 'create policy "insert_org_pages" on drawing_pages for insert with check (user_has_drawing_access(drawing_id))';
    execute 'create policy "update_org_pages" on drawing_pages for update using (user_has_drawing_access(drawing_id))';
    execute 'create policy "delete_org_pages" on drawing_pages for delete using (user_has_drawing_access(drawing_id))';
  end if;
end $$;

-- ── Takeoff Items RLS (conditional — table created in migration 003) ───────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'takeoff_items') then
    drop policy if exists "select_own_items" on takeoff_items;
    drop policy if exists "insert_own_items" on takeoff_items;
    drop policy if exists "update_own_items" on takeoff_items;
    drop policy if exists "delete_own_items" on takeoff_items;

    execute 'create policy "select_org_items" on takeoff_items for select using (user_has_page_access(drawing_page_id))';
    execute 'create policy "insert_org_items" on takeoff_items for insert with check (user_has_page_access(drawing_page_id))';
    execute 'create policy "update_org_items" on takeoff_items for update using (user_has_page_access(drawing_page_id))';
    execute 'create policy "delete_org_items" on takeoff_items for delete using (user_has_page_access(drawing_page_id))';
  end if;
end $$;

-- ── Estimates ──────────────────────────────────────────────────────────────────

create table estimates (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references projects(id) on delete cascade,
  name        text        not null,
  description text,
  status      text        not null default 'draft'
                check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_by  uuid        not null references profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table estimates enable row level security;

create policy "select_org_estimates" on estimates for select
  using (user_has_project_access(project_id));

create policy "insert_org_estimates" on estimates for insert
  with check (user_has_project_access(project_id));

create policy "update_org_estimates" on estimates for update
  using (user_has_project_access(project_id));

create policy "delete_org_estimates" on estimates for delete
  using (user_has_project_access(project_id));

-- ── Triggers ───────────────────────────────────────────────────────────────────

create trigger trg_organizations_updated_at
  before update on organizations for each row execute function set_updated_at();

create trigger trg_estimates_updated_at
  before update on estimates for each row execute function set_updated_at();
