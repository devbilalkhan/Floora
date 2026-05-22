create table task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  text text not null default '',
  done boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table task_checklist_items enable row level security;

create policy "checklist_select" on task_checklist_items for select
  using (
    exists (
      select 1 from tasks t
      where t.id = task_id
        and user_has_org_access(t.org_id)
        and (not t.is_private or t.created_by = auth.uid() or t.assigned_to = auth.uid())
    )
  );

create policy "checklist_insert" on task_checklist_items for insert
  with check (
    exists (
      select 1 from tasks t
      where t.id = task_id and user_has_org_access(t.org_id)
    )
  );

create policy "checklist_update" on task_checklist_items for update
  using (
    exists (
      select 1 from tasks t
      where t.id = task_id and user_has_org_access(t.org_id)
    )
  );

create policy "checklist_delete" on task_checklist_items for delete
  using (
    exists (
      select 1 from tasks t
      where t.id = task_id and user_has_org_access(t.org_id)
    )
  );
