-- ── 074: Protection estimates — door panels ───────────────────────────────────
-- Door panel tab: every rate is typed per line (no job defaults).
--   material = sheets_qty × price
--   install  = panels_qty × install_rate (+ panels_qty × cutting_rate when cutting_enabled)
--   glue     = panels_qty × glue_rate
-- All money is cost — admin and markup are applied in the Costing summary.

create table if not exists door_panel_lines (
  id               uuid primary key default gen_random_uuid(),
  estimate_id      uuid not null references protection_estimates(id) on delete cascade,
  project_id       uuid not null references projects(id) on delete cascade,
  sort_order       integer not null default 0,
  item             text,
  sheets_qty       integer not null default 0 check (sheets_qty >= 0),
  price            numeric,
  panels_qty       integer not null default 0 check (panels_qty >= 0),
  install_rate     numeric,
  cutting_enabled  boolean not null default false,
  cutting_rate     numeric,
  glue_rate        numeric,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists door_panel_lines_estimate_id_idx on door_panel_lines(estimate_id);

alter table door_panel_lines enable row level security;

-- Admin / project manager only — same rule as corner_guard_lines (068)
drop policy if exists "admin_pm_access" on door_panel_lines;
create policy "admin_pm_access" on door_panel_lines
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = door_panel_lines.project_id
    )
  );

drop trigger if exists trg_door_panel_lines_updated_at on door_panel_lines;
create trigger trg_door_panel_lines_updated_at
  before update on door_panel_lines for each row execute function set_updated_at();
