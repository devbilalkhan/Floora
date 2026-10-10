-- ── 067: Trade sheets ─────────────────────────────────────────────────────────
-- Free-form spreadsheet-style sheets for non-flooring trades on a project
-- (first trade: wall & door protection). Users define their own columns, so
-- the grid is stored as JSON on a single row per sheet:
--   columns: [{ id, name, type: 'text' | 'number' }]
--   rows:    [{ id, cells: { [columnId]: string } }]
-- Saves use updated_at as an optimistic-concurrency token.

create table if not exists trade_sheets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  trade       text not null default 'wall_door_protection',
  name        text not null,
  columns     jsonb not null default '[]'::jsonb,
  rows        jsonb not null default '[]'::jsonb,
  created_by  uuid references profiles(id),
  updated_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trade_sheets_project_id_idx on trade_sheets(project_id);

alter table trade_sheets enable row level security;

-- Admin / project manager only (same rule as actuals)
drop policy if exists "admin_pm_access" on trade_sheets;
create policy "admin_pm_access" on trade_sheets
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  );

drop trigger if exists trg_trade_sheets_updated_at on trade_sheets;
create trigger trg_trade_sheets_updated_at
  before update on trade_sheets for each row execute function set_updated_at();
