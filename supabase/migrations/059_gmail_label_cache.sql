-- ── Gmail label cache ──────────────────────────────────────────────────────────
-- Caches the Gmail label ID Google assigns when we create a nested label
-- (e.g. "Price Requests/{project}/{supplier}") so price-request sends don't
-- have to re-list/re-create the label on every send. Keyed per user since
-- each user's Gmail account has its own label IDs.

create table gmail_labels (
  user_id        uuid not null references auth.users(id) on delete cascade,
  label_path     text not null,
  gmail_label_id text not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, label_path)
);

alter table gmail_labels enable row level security;

create policy "own_gmail_labels" on gmail_labels
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
