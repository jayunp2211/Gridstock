-- The deal room's remaining steps: a versioned NDA, units per deal, an inspection record, an escrow record,
-- shared documents, and messages from the contact form.
-- Additive only: new nullable columns and new tables. No existing row changes.
-- Safe to run more than once, and safe to apply before the code that uses it.

-- Which version of the agreement the two sides accepted.
alter table deals add column if not exists nda_version text;

-- How many units the deal covers. An accepted offer reserves these and leaves the rest of the listing open.
-- Empty on deals opened before this change, which cover what the buyer needs, up to what was listed.
alter table deals add column if not exists quantity integer;

-- Inspection: the independent firm the buyer appointed, the planned date, and what the buyer decided afterwards.
alter table deals add column if not exists inspector text;
alter table deals add column if not exists inspection_on date;
alter table deals add column if not exists inspection_result text check (inspection_result in ('passed','waived','failed'));
alter table deals add column if not exists inspection_at timestamptz;

-- Escrow: the agent that holds the money, and each side's own confirmation. Gridstock never holds funds.
alter table deals add column if not exists escrow_agent text;
alter table deals add column if not exists escrow_funded_at timestamptz;
alter table deals add column if not exists escrow_confirmed_at timestamptz;
alter table deals add column if not exists escrow_released_at timestamptz;

-- Documents shared in a deal room. The bytes travel and are stored in parts, so no single request is large.
create table if not exists deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  uploaded_by uuid not null references users(id),
  kind text not null,
  name text not null,
  mime text not null,
  size integer not null check (size > 0),
  parts integer not null check (parts > 0),
  complete boolean not null default false,
  -- In the public demo a file can be opened only from the browser that uploaded it. Empty for real accounts.
  visitor uuid,
  created_at timestamptz not null default now()
);
create index if not exists deal_files_deal_id_idx on deal_files (deal_id);

create table if not exists deal_file_parts (
  file_id uuid not null references deal_files(id) on delete cascade,
  seq integer not null,
  data bytea not null,
  primary key (file_id, seq)
);
-- PDFs and photos are already compressed, so do not spend time trying again.
alter table deal_file_parts alter column data set storage external;

-- Messages sent through the contact form on the about page.
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  body text not null,
  created_at timestamptz not null default now()
);

-- The same protection as every other table: nothing is readable through the public API,
-- and only the app's own database role can use the new tables.
alter table deal_files enable row level security;
alter table deal_file_parts enable row level security;
alter table contact_messages enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on deal_files, deal_file_parts, contact_messages from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on deal_files, deal_file_parts, contact_messages from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'gridstock_app') then
    grant select, insert, update, delete, truncate on deal_files, deal_file_parts, contact_messages to gridstock_app;
  end if;
end $$;
