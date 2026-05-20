-- Tighten write access on takeoffs and project_takeoff to exclude viewers.
-- Reads remain open to all org members (existing select policies unchanged).

drop policy if exists "insert_takeoffs" on takeoffs;
drop policy if exists "update_takeoffs" on takeoffs;
drop policy if exists "delete_takeoffs" on takeoffs;

create policy "insert_takeoffs" on takeoffs for insert
  with check (is_superadmin() or user_has_project_write_access(project_id));

create policy "update_takeoffs" on takeoffs for update
  using (is_superadmin() or user_has_project_write_access(project_id));

create policy "delete_takeoffs" on takeoffs for delete
  using (is_superadmin() or user_has_project_write_access(project_id));

drop policy if exists "insert_org_takeoff" on project_takeoff;
drop policy if exists "update_org_takeoff" on project_takeoff;
drop policy if exists "delete_org_takeoff" on project_takeoff;

create policy "insert_org_takeoff" on project_takeoff for insert
  with check (exists (
    select 1 from takeoffs t
    where t.id = takeoff_id and (is_superadmin() or user_has_project_write_access(t.project_id))
  ));

create policy "update_org_takeoff" on project_takeoff for update
  using (exists (
    select 1 from takeoffs t
    where t.id = takeoff_id and (is_superadmin() or user_has_project_write_access(t.project_id))
  ));

create policy "delete_org_takeoff" on project_takeoff for delete
  using (exists (
    select 1 from takeoffs t
    where t.id = takeoff_id and (is_superadmin() or user_has_project_write_access(t.project_id))
  ));
