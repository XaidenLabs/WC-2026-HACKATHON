-- TxAgent — per-user paper-trading bets.
-- Run once in the Supabase SQL editor. Until then, the app uses an in-memory fallback
-- (works for a single-server demo but won't persist across restarts or instances).
-- All access is via the server-side service-role key (bypasses RLS); no policies required.

create table if not exists trader_bets (
  id          uuid primary key default gen_random_uuid(),
  user_did    text not null,
  fixture_id  bigint not null,
  match       text not null,
  selection   text not null check (selection in ('home','draw','away')),
  odds        numeric not null,
  stake       numeric not null,
  status      text not null default 'open' check (status in ('open','won','lost')),
  pnl         numeric,
  created_at  timestamptz not null default now()
);

create index if not exists trader_bets_user_idx on trader_bets(user_did);

alter table trader_bets enable row level security;
