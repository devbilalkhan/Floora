alter table tasks
  add column source text not null default 'manual'
  check (source in ('manual', 'voice'));
