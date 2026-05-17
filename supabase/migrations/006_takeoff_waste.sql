alter table project_takeoff
  add column if not exists waste_pct numeric(5,2) not null default 10;
