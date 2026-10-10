-- ── 072: Protection estimates — handrails ─────────────────────────────────────
-- Handrail tab: job defaults on protection_estimates, priced per linear metre.
--   labour   = length_lm × install rate            (measured length — no wastage)
--   material = order_lm × price + brackets + screws (order_lm = user-typed length
--              incl. wastage; null = measured length)
-- All money is cost — admin and markup are applied in the Costing summary.
-- Line rate columns are nullable: null = inherit the job default.

alter table protection_estimates
  add column if not exists hr_default_price  numeric,
  add column if not exists hr_install_rate   numeric default 60;

create table if not exists handrail_lines (
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

create index if not exists handrail_lines_estimate_id_idx on handrail_lines(estimate_id);

alter table handrail_lines enable row level security;

-- Admin / project manager only — same rule as corner_guard_lines (068)
drop policy if exists "admin_pm_access" on handrail_lines;
create policy "admin_pm_access" on handrail_lines
  for all using (
    is_superadmin()
    or user_project_role(project_id) in ('admin', 'project_manager')
  )
  with check (
    (is_superadmin() or user_project_role(project_id) in ('admin', 'project_manager'))
    and exists (
      select 1 from protection_estimates e
      where e.id = estimate_id and e.project_id = handrail_lines.project_id
    )
  );

drop trigger if exists trg_handrail_lines_updated_at on handrail_lines;
create trigger trg_handrail_lines_updated_at
  before update on handrail_lines for each row execute function set_updated_at();
