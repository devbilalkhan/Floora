create table if not exists takeoff_items (
  id               uuid primary key default gen_random_uuid(),
  drawing_page_id  uuid not null references drawing_pages(id) on delete cascade,
  owner_id         uuid not null references profiles(id) on delete cascade,
  type             text not null check (type in ('area', 'linear', 'count')),
  label            text not null,
  scope_category   text not null check (scope_category in (
                     'vinyl', 'carpet', 'coving', 'skirting', 'transition',
                     'wall_vinyl', 'stairs', 'trim', 'matting_systems', 'other'
                   )),
  color            text not null,
  geometry         jsonb not null default '{"points": []}',
  computed_value   numeric not null default 0,
  unit             text not null check (unit in ('m2', 'lm', 'count')),
  notes            text,
  locked           boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table takeoff_items enable row level security;

create policy "select_own_items" on takeoff_items for select using (auth.uid() = owner_id);
create policy "insert_own_items" on takeoff_items for insert with check (auth.uid() = owner_id);
create policy "update_own_items" on takeoff_items for update using (auth.uid() = owner_id);
create policy "delete_own_items" on takeoff_items for delete using (auth.uid() = owner_id);

create trigger trg_takeoff_items_updated_at
  before update on takeoff_items for each row execute function set_updated_at();
