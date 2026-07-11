-- Add specifier and contact_person to projects
alter table projects
  add column if not exists specifier     text,
  add column if not exists contact_person text;
