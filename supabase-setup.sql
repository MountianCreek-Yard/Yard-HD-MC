-- Run this once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists yard_docs (
  path text primary key,
  coll text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists yard_docs_coll on yard_docs (coll);

alter table yard_docs enable row level security;

-- Anyone who has your site's address and key can read and change yard data.
-- See "Security" in README.md before putting real customer data in here.
create policy "yard open access" on yard_docs
  for all to anon using (true) with check (true);
