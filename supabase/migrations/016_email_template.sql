-- Stores the org-level price request email template.
-- Null means "use the application default".
alter table organizations
  add column if not exists price_request_template text;
