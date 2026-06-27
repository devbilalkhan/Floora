create table voice_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  token_hash  text not null unique,  -- sha-256 of raw token; raw never stored
  label       text,
  last_used   timestamptz,
  revoked_at  timestamptz,           -- soft revoke; null = active
  created_at  timestamptz default now()
);

alter table voice_tokens enable row level security;

-- Users can only see/delete their own tokens
create policy "own_voice_tokens" on voice_tokens
  using (user_id = auth.uid());
