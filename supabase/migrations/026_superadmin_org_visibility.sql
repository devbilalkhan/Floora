-- Allow superadmins to select all organizations and their members

drop policy "select_member_org" on organizations;
create policy "select_member_org" on organizations for select
  using (is_superadmin() or user_has_org_access(id));

drop policy "select_org_members" on organization_members;
create policy "select_org_members" on organization_members for select
  using (is_superadmin() or user_has_org_access(organization_id));
