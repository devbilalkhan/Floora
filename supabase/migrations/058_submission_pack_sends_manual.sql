-- ── 058: Manual submission pack sends ─────────────────────────────────────────
-- Lets a user record a pack as already sent (e.g. sent before this feature
-- existed, or sent outside Gmail) without going through the email composer.
-- These entries have no subject/email captured, so relax those columns and
-- flag them with `manual` so the UI can tell the two kinds of record apart.

alter table submission_pack_sends
  alter column recipient_email drop not null;

alter table submission_pack_sends
  alter column subject drop not null;

alter table submission_pack_sends
  add column if not exists manual boolean not null default false;
