-- ── Projects ────────────────────────────────────────────────

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  location    text,
  head_client text,
  status      text not null default 'active' check (status in ('active', 'archived')),
  brand       text not null default 'spm'    check (brand  in ('spm', 'dfo')),
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table projects enable row level security;

create policy "select_own_projects" on projects for select using (auth.uid() = owner_id);
create policy "insert_own_projects" on projects for insert with check (auth.uid() = owner_id);
create policy "update_own_projects" on projects for update using (auth.uid() = owner_id);
create policy "delete_own_projects" on projects for delete using (auth.uid() = owner_id);

-- ── Drawings ─────────────────────────────────────────────────

create table if not exists drawings (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  owner_id     uuid not null references profiles(id) on delete cascade,
  name         text not null,
  type         text not null default 'floor_plan'
                 check (type in ('floor_plan', 'elevation', 'detail', 'other')),
  storage_path text not null,
  mime_type    text not null,
  page_count   int  not null default 1,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table drawings enable row level security;

create policy "select_own_drawings" on drawings for select using (auth.uid() = owner_id);
create policy "insert_own_drawings" on drawings for insert with check (auth.uid() = owner_id);
create policy "update_own_drawings" on drawings for update using (auth.uid() = owner_id);
create policy "delete_own_drawings" on drawings for delete using (auth.uid() = owner_id);

-- ── Drawing Pages ────────────────────────────────────────────

create table if not exists drawing_pages (
  id                   uuid primary key default gen_random_uuid(),
  drawing_id           uuid not null references drawings(id) on delete cascade,
  owner_id             uuid not null references profiles(id) on delete cascade,
  page_number          int  not null default 1,
  width_px             numeric,
  height_px            numeric,
  scale_factor         numeric,
  scale_calibrated_at  timestamptz,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table drawing_pages enable row level security;

create policy "select_own_pages" on drawing_pages for select using (auth.uid() = owner_id);
create policy "insert_own_pages" on drawing_pages for insert with check (auth.uid() = owner_id);
create policy "update_own_pages" on drawing_pages for update using (auth.uid() = owner_id);
create policy "delete_own_pages" on drawing_pages for delete using (auth.uid() = owner_id);

-- ── updated_at triggers ──────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_projects_updated_at
  before update on projects for each row execute function set_updated_at();

create trigger trg_drawings_updated_at
  before update on drawings for each row execute function set_updated_at();

create trigger trg_drawing_pages_updated_at
  before update on drawing_pages for each row execute function set_updated_at();

-- ── Storage bucket ───────────────────────────────────────────
-- Run this separately in the Supabase dashboard → Storage → New bucket:
--   Name: drawings
--   Public: false
--
-- Then add these Storage policies in Dashboard → Storage → drawings → Policies:
--
-- SELECT (download):
--   (auth.uid())::text = (storage.foldername(name))[1]
--
-- INSERT (upload):
--   (auth.uid())::text = (storage.foldername(name))[1]
--
-- DELETE:
--   (auth.uid())::text = (storage.foldername(name))[1]
