alter table organizations
  add column if not exists quote_terms text,
  add column if not exists quote_notes text;
