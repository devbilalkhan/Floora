-- ── 073: Protection estimates — crash rail ────────────────────────────────────
-- Crash rail prices exactly like handrails (072): per linear metre, labour on the
-- measured length, material on the typed-in order length + brackets + screws.
-- Same columns as handrail_lines; job defaults are cr_ on protection_estimates.

alter table protection_estimates
  add column if not exists cr_default_price  numeric,
  add column if not exists cr_install_rate   numeric default 60;

create table if not exists crash_rail_lines (
  id              uuid primary key default gen_random_uuid(),
  estimate_id     uuid not null references protection_estimates(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  sort_order      integer not null default 0,
  description     text,
  length_lm       numeric check (length_lm >= 0),
  order_lm        numeric check (order_lm >= 0),
  price           numeric,
  install_rate    numeric,
  brackets_qty    integer not null default 0 check (brackets_qty >= 0),
  bracket_price   numeric,
  screws_qty      integer not null default 0 check (screws_qty >= 0),
  screw_price     numeric,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crash_rail_lines_estimate_id_idx on crash_rail_lines(estimate_id);

alter table crash_rail_lines enable row level security;

-- Admin / project manager only — same rule as corner_guard_lines (068)
drop policy if exists "admin_pm_access" on crash_rail_lines;
create policy "admin_pm_access" on crash_rail_lines
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = crash_rail_lines.project_id
    )
  );

drop trigger if exists trg_crash_rail_lines_updated_at on crash_rail_lines;
create trigger trg_crash_rail_lines_updated_at
  before update on crash_rail_lines for each row execute function set_updated_at();
