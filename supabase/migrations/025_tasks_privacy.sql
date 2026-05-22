-- Add is_private column (default true = private to creator)
alter table tasks add column is_private boolean not null default true;

-- Recreate RLS policies with privacy enforcement
drop policy "select_org_tasks" on tasks;
drop policy "update_org_tasks" on tasks;
drop policy "delete_org_tasks" on tasks;

-- Visible if: you created it, you're assigned, OR it's been shared (is_private = false)
create policy "select_org_tasks" on tasks for select
  using (
    user_has_org_access(org_id)
    and (
      created_by  = auth.uid()
      or assigned_to = auth.uid()
      or not is_private
    )
  );

-- Only the creator can edit or delete their own tasks
create policy "update_org_tasks" on tasks for update
  using (user_has_org_access(org_id) and created_by = auth.uid());

create policy "delete_org_tasks" on tasks for delete
  using (user_has_org_access(org_id) and created_by = auth.uid());
