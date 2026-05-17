-- Run this in the Supabase SQL editor or via supabase db push.

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

create policy "select_own_profile" on profiles
  for select using (auth.uid() = id);

create policy "insert_own_profile" on profiles
  for insert with check (auth.uid() = id);

create policy "update_own_profile" on profiles
  for update using (auth.uid() = id);
