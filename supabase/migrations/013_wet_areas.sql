-- ── 013: Wet areas labour ──────────────────────────────────────────────────────
create table if not exists estimate_wet_areas (
  id             uuid primary key default gen_random_uuid(),
  estimate_id    uuid not null references estimates(id) on delete cascade,
  sort_order     int not null default 0,
  name           text not null default 'Wet Area',
  floor_sqm      numeric(10,3) not null default 0,
  wall_semi_sqm  numeric(10,3) not null default 0,  -- up to 1500mH
  wall_full_sqm  numeric(10,3) not null default 0,  -- 2000mH
  coving_lm      numeric(10,3) not null default 0,
  qty            integer       not null default 1,
  charge         numeric(10,2) not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table estimate_wet_areas enable row level security;

create policy "select_estimate_wet_areas" on estimate_wet_areas for select
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "insert_estimate_wet_areas" on estimate_wet_areas for insert
  with check (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "update_estimate_wet_areas" on estimate_wet_areas for update
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

create policy "delete_estimate_wet_areas" on estimate_wet_areas for delete
  using (exists (
    select 1 from estimates e
    where e.id = estimate_id and user_has_project_access(e.project_id)
  ));

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_estimate_wet_areas_updated_at') then
    create trigger trg_estimate_wet_areas_updated_at
      before update on estimate_wet_areas for each row execute function set_updated_at();
  end if;
end $$;
