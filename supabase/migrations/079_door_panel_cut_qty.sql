-- ── 079: Door panels — manual cut quantity ────────────────────────────────────
-- cut_qty = number of panels to cut. Null = same as panels_qty (the default).
--   install = panels_qty × install_rate (+ cut qty × cutting_rate when cutting_enabled)

alter table door_panel_lines
  add column if not exists cut_qty integer check (cut_qty >= 0);
