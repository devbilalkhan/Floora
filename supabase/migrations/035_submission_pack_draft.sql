-- ── 035: Submission pack draft ────────────────────────────────────────────────
-- Stores the serialised form state for the submission pack builder per project.
-- Reuses the existing update_org_projects RLS policy (PM+ can write).

alter table projects
  add column if not exists submission_pack_draft jsonb;
