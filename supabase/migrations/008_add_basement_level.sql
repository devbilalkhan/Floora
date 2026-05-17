-- Add B1, B2 (basement levels) to the level check constraint on project_takeoff

alter table project_takeoff drop constraint if exists project_takeoff_level_check;
alter table project_takeoff
  add constraint project_takeoff_level_check
  check (level in ('B2', 'B1', 'GF', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'));
