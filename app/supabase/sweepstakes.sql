-- WHISTL Pulse — Group Sweepstake tables.
-- Run once in the Supabase SQL editor. Until then, the app uses an in-memory fallback
-- (works for a single-server demo but won't persist across restarts or instances).
--
-- All access is via the server-side service-role key, which bypasses RLS, so no policies
-- are required. (RLS stays enabled + locked, denying anon/auth direct access.)

create table if not exists sweepstakes (
  code        text primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists sweep_members (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references sweepstakes(code) on delete cascade,
  name        text not null,
  team        text not null,
  is_creator  boolean not null default false,
  joined_at   timestamptz not null default now()
);

create index if not exists sweep_members_code_idx on sweep_members(code);

alter table sweepstakes   enable row level security;
alter table sweep_members enable row level security;
