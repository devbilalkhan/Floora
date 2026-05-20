-- ── Gmail token storage ────────────────────────────────────────────────────────
-- Stores Google OAuth refresh tokens so the server can call Gmail API on behalf
-- of the user without requiring them to be actively signed in.

create table user_gmail_tokens (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at   timestamptz not null default now()
);

alter table user_gmail_tokens enable row level security;

create policy "own_gmail_token" on user_gmail_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Price requests ─────────────────────────────────────────────────────────────
-- Records each supplier price-request email sent from a project.
-- gmail_thread_id enables reply auto-capture: when a reply arrives in the
-- sender's inbox, we match it by thread and flip status to 'received'.

create table price_requests (
  id                 uuid        primary key default gen_random_uuid(),
  project_id         uuid        not null references projects(id) on delete cascade,
  takeoff_id         uuid        references takeoffs(id) on delete set null,
  supplier_name      text,
  supplier_email     text        not null,
  subject            text        not null,
  email_body         text        not null,
  products           jsonb       not null default '[]',
  status             text        not null default 'sent'
                       check (status in ('draft', 'sent', 'received')),
  gmail_message_id   text,
  gmail_thread_id    text,
  reply_body         text,
  reply_from         text,
  reply_received_at  timestamptz,
  sent_at            timestamptz,
  created_by         uuid        references auth.users(id),
  created_at         timestamptz not null default now()
);

alter table price_requests enable row level security;

create policy "select_price_requests" on price_requests for select
  using (user_has_project_access(project_id));

create policy "insert_price_requests" on price_requests for insert
  with check (user_has_project_access(project_id));

create policy "update_price_requests" on price_requests for update
  using (user_has_project_access(project_id));

create policy "delete_price_requests" on price_requests for delete
  using (user_has_project_access(project_id));
