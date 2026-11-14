-- Gridstock schema. Plain Postgres, compatible with Supabase.
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  company text not null,
  role text not null check (role in ('seller','buyer','admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references users(id),
  category text not null,
  oem text not null,
  model text,
  voltage_v integer not null,
  amps integer not null,
  kaic integer,
  enclosure text,
  standard text,
  condition text not null check (condition in ('new_crated','delivered_not_energized','used')),
  quantity integer not null default 1,
  location_state text not null,
  available_date date not null,
  asking_price integer,
  warranty_status text,
  notes text,
  status text not null default 'active' check (status in ('active','under_offer','sold','withdrawn')),
  created_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users(id),
  category text not null,
  voltage_v integer not null,
  amps_min integer not null,
  kaic_min integer,
  enclosure text,
  acceptable_oems text[] not null default '{}',
  conditions_ok text[] not null default '{new_crated,delivered_not_energized}',
  quantity integer not null default 1,
  site_state text not null,
  need_by date not null,
  budget_max integer,
  notes text,
  status text not null default 'open' check (status in ('open','in_deal','closed')),
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  score integer not null,
  gaps jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (request_id, listing_id)
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id),
  stage text not null default 'nda' check (stage in ('nda','documents','offer','inspection','escrow','closed','lost')),
  buyer_nda_at timestamptz,
  seller_nda_at timestamptz,
  offer_price integer,
  fee_pct numeric(4,2) not null default 5.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_messages (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  author_id uuid references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
