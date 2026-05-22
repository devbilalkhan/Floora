drop policy if exists "update_org_tasks" on tasks;
drop policy if exists "delete_org_tasks" on tasks;

create policy "update_org_tasks" on tasks for update
  using (
    user_has_org_access(org_id)
    and (
      created_by = auth.uid()
      or user_org_role(org_id) in ('admin', 'project_manager')
    )
  );

create policy "delete_org_tasks" on tasks for delete
  using (
    user_has_org_access(org_id)
    and (
      created_by = auth.uid()
      or user_org_role(org_id) in ('admin', 'project_manager')
    )
  );
