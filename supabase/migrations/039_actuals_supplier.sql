-- Add supplier column to actual_line_items
alter table actual_line_items
  add column if not exists supplier text;
