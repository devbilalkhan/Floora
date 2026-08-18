-- Widen coving height options from {100,150,200} up to 500mm in 50mm steps
alter table project_takeoff
  drop constraint if exists project_takeoff_cove_height_mm_check;

alter table project_takeoff
  add constraint project_takeoff_cove_height_mm_check
  check (cove_height_mm is null or cove_height_mm in (100, 150, 200, 250, 300, 350, 400, 450, 500));
