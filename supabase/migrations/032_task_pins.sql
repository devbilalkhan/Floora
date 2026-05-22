create table task_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

alter table task_pins enable row level security;

create policy "pins_select" on task_pins for select
  using (user_id = auth.uid());

create policy "pins_insert" on task_pins for insert
  with check (user_id = auth.uid());

create policy "pins_delete" on task_pins for delete
  using (user_id = auth.uid());
