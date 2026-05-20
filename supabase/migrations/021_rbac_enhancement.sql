-- ── 021: Role-Based Access Control Enhancement ────────────────────────────────
--
-- Changes from baseline (migration 004):
--   1. Add app_role to profiles — 'superadmin' | 'user' (platform-level admin)
--   2. Add 'viewer' to org_role enum — read-only org membership
--   3. New helpers: is_superadmin(), user_project_role(), user_has_project_write_access()
--   4. Fix insert_org: was open to any authed user, now superadmin only
--   5. Fix insert_org_members: add superadmin override
--   6. Projects: estimators can now create; viewers blocked from all writes
--   7. Estimates: PM+ to create/delete; estimators read-only on the estimates row
--   8. Estimate items: all non-viewers (estimators add markup line items here)
--   9. Drawings + pages + takeoff items: all non-viewers
--  10. Price requests: PM+ to create/delete; all members read
--  11. Tasks: non-viewers create/update; PM+ delete
--  12. SWMS: non-viewers write; viewers read
--  13. Org workers: superadmin override added (was already PM+)

-- ── 1. App-level role ──────────────────────────────────────────────────────────

alter table profiles
  add column if not exists app_role text not null default 'user'
    check (app_role in ('superadmin', 'user'));

-- ── 2. Viewer org role ─────────────────────────────────────────────────────────

alter type org_role add value if not exists 'viewer';

-- ── 3. Helper functions ────────────────────────────────────────────────────────

-- Returns true when the calling user is the platform superadmin.
create or replace function is_superadmin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select app_role = 'superadmin' from profiles where id = auth.uid()),
    false
  )
$$;

-- Returns the org_role the calling user holds in the org that owns a project.
-- Used in policies that need PM-vs-estimator distinction at project level.
create or replace function user_project_role(proj_id uuid)
returns text language sql security definer stable as $$
  select om.role::text
  from projects p
  join organization_members om on om.organization_id = p.organization_id
  where p.id = proj_id and om.user_id = auth.uid()
  limit 1
$$;

-- Returns true when the calling user is an org member (not viewer) for the project.
-- Used on all write policies for drawings, takeoffs, and estimate items.
create or replace function user_has_project_write_access(proj_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from projects p
    join organization_members om on om.organization_id = p.organization_id
    where p.id = proj_id
      and om.user_id = auth.uid()
      and om.role::text != 'viewer'
  )
$$;

-- ── 4. Organizations ───────────────────────────────────────────────────────────

-- Only superadmin creates orgs (previously any authenticated user could).
drop policy if exists "insert_org" on organizations;
create policy "insert_org" on organizations for insert
  with check (is_superadmin());

-- Org admin or superadmin can update org settings.
drop policy if exists "update_org" on organizations;
create policy "update_org" on organizations for update
  using (is_superadmin() or user_org_role(id) = 'admin');

-- ── 5. Organization members ────────────────────────────────────────────────────

drop policy if exists "insert_org_members" on organization_members;
create policy "insert_org_members" on organization_members for insert
  with check (
    is_superadmin()
    or user_org_role(organization_id) = 'admin'
    -- Bootstrap: allow insert when the org has no members yet
    or not exists (
      select 1 from organization_members e
      where e.organization_id = organization_members.organization_id
    )
  );

drop policy if exists "update_org_members" on organization_members;
create policy "update_org_members" on organization_members for update
  using (is_superadmin() or user_org_role(organization_id) = 'admin');

drop policy if exists "delete_org_members" on organization_members;
create policy "delete_org_members" on organization_members for delete
  using (is_superadmin() or user_org_role(organization_id) = 'admin');

-- ── 6. Projects ────────────────────────────────────────────────────────────────

drop policy if exists "insert_org_projects" on projects;
drop policy if exists "update_org_projects" on projects;
drop policy if exists "delete_org_projects" on projects;

-- Estimators can create projects; viewers cannot.
create policy "insert_org_projects" on projects for insert
  with check (
    is_superadmin()
    or user_org_role(organization_id) in ('admin', 'project_manager', 'estimator')
  );

-- Only PM+ can edit project metadata (name, status, client, notes).
create policy "update_org_projects" on projects for update
  using (
    is_superadmin()
    or user_org_role(organization_id) in ('admin', 'project_manager')
  );

-- Only org admin can delete projects.
create policy "delete_org_projects" on projects for delete
  using (
    is_superadmin()
    or user_org_role(organization_id) = 'admin'
  );

-- ── 7. Estimates ───────────────────────────────────────────────────────────────

drop policy if exists "insert_org_estimates" on estimates;
drop policy if exists "update_org_estimates" on estimates;
drop policy if exists "delete_org_estimates" on estimates;

-- Only PM+ can create estimates (estimates contain pricing — PM responsibility).
create policy "insert_org_estimates" on estimates for insert
  with check (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

-- Only PM+ can update estimates (rates, status, markups are PM-owned).
-- Estimate items (line items) are the estimator write surface — see section 8.
create policy "update_org_estimates" on estimates for update
  using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

-- Only PM+ can delete estimates.
create policy "delete_org_estimates" on estimates for delete
  using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

-- Note: estimate status transitions (draft→submitted→approved) must also be
-- enforced in server actions — RLS cannot guard individual field changes.

-- ── 8. Estimate items ──────────────────────────────────────────────────────────
-- Estimators write here: they add quantities, markup line items, and notes.
-- Viewers are read-only.

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'estimate_items') then
    execute 'drop policy if exists "insert_estimate_items" on estimate_items';
    execute 'drop policy if exists "update_estimate_items" on estimate_items';
    execute 'drop policy if exists "delete_estimate_items" on estimate_items';
    execute $pol$
      create policy "insert_estimate_items" on estimate_items for insert
        with check (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "update_estimate_items" on estimate_items for update
        using (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "delete_estimate_items" on estimate_items for delete
        using (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
  end if;
end $$;

-- ── 9. Drawings ────────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'drawings') then
    execute 'drop policy if exists "insert_org_drawings" on drawings';
    execute 'drop policy if exists "update_org_drawings" on drawings';
    execute 'drop policy if exists "delete_org_drawings" on drawings';
    execute $pol$
      create policy "insert_org_drawings" on drawings for insert
        with check (is_superadmin() or user_has_project_write_access(project_id))
    $pol$;
    execute $pol$
      create policy "update_org_drawings" on drawings for update
        using (is_superadmin() or user_has_project_write_access(project_id))
    $pol$;
    execute $pol$
      create policy "delete_org_drawings" on drawings for delete
        using (is_superadmin() or user_has_project_write_access(project_id))
    $pol$;
  end if;
end $$;

-- ── 10. Drawing pages ──────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'drawing_pages') then
    execute 'drop policy if exists "insert_org_pages" on drawing_pages';
    execute 'drop policy if exists "update_org_pages" on drawing_pages';
    execute 'drop policy if exists "delete_org_pages" on drawing_pages';
    execute $pol$
      create policy "insert_org_pages" on drawing_pages for insert
        with check (
          is_superadmin()
          or exists (
            select 1 from drawings d
            where d.id = drawing_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "update_org_pages" on drawing_pages for update
        using (
          is_superadmin()
          or exists (
            select 1 from drawings d
            where d.id = drawing_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "delete_org_pages" on drawing_pages for delete
        using (
          is_superadmin()
          or exists (
            select 1 from drawings d
            where d.id = drawing_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
  end if;
end $$;

-- ── 11. Takeoff items ──────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'takeoff_items') then
    execute 'drop policy if exists "insert_org_items" on takeoff_items';
    execute 'drop policy if exists "update_org_items" on takeoff_items';
    execute 'drop policy if exists "delete_org_items" on takeoff_items';
    execute $pol$
      create policy "insert_org_items" on takeoff_items for insert
        with check (
          is_superadmin()
          or exists (
            select 1 from drawing_pages dp
            join drawings d on d.id = dp.drawing_id
            where dp.id = drawing_page_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "update_org_items" on takeoff_items for update
        using (
          is_superadmin()
          or exists (
            select 1 from drawing_pages dp
            join drawings d on d.id = dp.drawing_id
            where dp.id = drawing_page_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "delete_org_items" on takeoff_items for delete
        using (
          is_superadmin()
          or exists (
            select 1 from drawing_pages dp
            join drawings d on d.id = dp.drawing_id
            where dp.id = drawing_page_id
              and user_has_project_write_access(d.project_id)
          )
        )
    $pol$;
  end if;
end $$;

-- ── 12. Price requests ─────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'price_requests') then
    execute 'drop policy if exists "insert_price_requests" on price_requests';
    execute 'drop policy if exists "delete_price_requests" on price_requests';
    execute $pol$
      create policy "insert_price_requests" on price_requests for insert
        with check (
          is_superadmin()
          or user_project_role(project_id) in ('admin', 'project_manager')
        )
    $pol$;
    execute $pol$
      create policy "delete_price_requests" on price_requests for delete
        using (
          is_superadmin()
          or user_project_role(project_id) in ('admin', 'project_manager')
        )
    $pol$;
  end if;
end $$;

-- ── 13. Tasks ──────────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'tasks') then
    execute 'drop policy if exists "insert_org_tasks" on tasks';
    execute 'drop policy if exists "update_org_tasks" on tasks';
    execute 'drop policy if exists "delete_org_tasks" on tasks';
    execute $pol$
      create policy "insert_org_tasks" on tasks for insert
        with check (
          created_by = auth.uid()
          and (
            is_superadmin()
            or (user_has_org_access(org_id) and user_org_role(org_id) != 'viewer')
          )
        )
    $pol$;
    execute $pol$
      create policy "update_org_tasks" on tasks for update
        using (
          is_superadmin()
          or (user_has_org_access(org_id) and user_org_role(org_id) != 'viewer')
        )
    $pol$;
    execute $pol$
      create policy "delete_org_tasks" on tasks for delete
        using (
          is_superadmin()
          or user_org_role(org_id) in ('admin', 'project_manager')
        )
    $pol$;
  end if;
end $$;

-- ── 14. SWMS ───────────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'swms') then
    execute 'drop policy if exists "insert_swms" on swms';
    execute 'drop policy if exists "update_swms" on swms';
    execute 'drop policy if exists "delete_swms" on swms';
    execute $pol$
      create policy "insert_swms" on swms for insert
        with check (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "update_swms" on swms for update
        using (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
    execute $pol$
      create policy "delete_swms" on swms for delete
        using (
          is_superadmin()
          or exists (
            select 1 from estimates e
            where e.id = estimate_id
              and user_has_project_write_access(e.project_id)
          )
        )
    $pol$;
  end if;
end $$;

-- ── 15. Org workers ────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'org_workers') then
    execute 'drop policy if exists "insert_org_workers" on org_workers';
    execute 'drop policy if exists "update_org_workers" on org_workers';
    execute 'drop policy if exists "delete_org_workers" on org_workers';
    execute $pol$
      create policy "insert_org_workers" on org_workers for insert
        with check (
          is_superadmin()
          or user_org_role(org_id) in ('admin', 'project_manager')
        )
    $pol$;
    execute $pol$
      create policy "update_org_workers" on org_workers for update
        using (
          is_superadmin()
          or user_org_role(org_id) in ('admin', 'project_manager')
        )
    $pol$;
    execute $pol$
      create policy "delete_org_workers" on org_workers for delete
        using (
          is_superadmin()
          or user_org_role(org_id) in ('admin', 'project_manager')
        )
    $pol$;
  end if;
end $$;
