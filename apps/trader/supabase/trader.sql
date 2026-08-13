-- TxAgent per-user sandbox trading and supervised-execution state.
-- Run in the Supabase SQL editor. The application deliberately has no in-memory
-- production fallback because authorization and execution receipts must persist.
-- All access is through authenticated server routes using the service-role key.

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
  proposal_id uuid,
  execution_ref text,
  source text not null default 'txline' check (source in ('txline','replay','devnet')),
  created_at  timestamptz not null default now()
);

create index if not exists trader_bets_user_idx on trader_bets(user_did);

alter table trader_bets enable row level security;

-- ── Migration: multi-market support (match winner + goals over/under). Safe to re-run. ──
alter table trader_bets add column if not exists market text not null default '1x2';
alter table trader_bets add column if not exists line   numeric;
alter table trader_bets add column if not exists proposal_id uuid;
alter table trader_bets add column if not exists execution_ref text;
alter table trader_bets add column if not exists source text not null default 'txline';
-- Allow over/under selections (goals market) alongside 1X2.
alter table trader_bets drop constraint if exists trader_bets_selection_check;
alter table trader_bets add constraint trader_bets_selection_check
  check (selection in ('home','draw','away','over','under'));
create unique index if not exists trader_bets_proposal_idx
  on trader_bets(proposal_id) where proposal_id is not null;

create table if not exists trader_mandates (
  user_did            text primary key,
  auto_execute        boolean not null default false,
  paused              boolean not null default false,
  killed              boolean not null default false,
  max_stake           numeric not null check (max_stake > 0 and max_stake <= 10000),
  max_daily_stake     numeric not null check (max_daily_stake >= max_stake and max_daily_stake <= 100000),
  min_ev_pct          numeric not null check (min_ev_pct >= 0 and min_ev_pct <= 100),
  max_odds_drift_pct  numeric not null check (max_odds_drift_pct >= 0 and max_odds_drift_pct <= 25),
  allowed_markets     text[] not null check (cardinality(allowed_markets) > 0),
  updated_at          timestamptz not null default now()
);

create table if not exists trader_proposals (
  id                         uuid primary key,
  user_did                   text not null references trader_mandates(user_did) on delete cascade,
  idempotency_key            text not null,
  fixture_id                 bigint not null,
  match                      text not null,
  market                     text not null check (market in ('1x2','goals_ou')),
  line                       numeric,
  selection                  text not null check (selection in ('home','draw','away','over','under')),
  predicted_probability_pct  numeric not null check (predicted_probability_pct between 0 and 100),
  market_probability_pct     numeric not null check (market_probability_pct between 0 and 100),
  ev_pct                     numeric not null,
  quoted_odds                numeric not null check (quoted_odds > 1),
  stake                      numeric not null check (stake > 0),
  status                     text not null check (status in ('pending','executing','executed','declined','expired','blocked','failed')),
  auto_execute_authorized    boolean not null,
  created_at                 timestamptz not null,
  decision_deadline_at       timestamptz not null,
  execution_deadline_at      timestamptz not null,
  trigger                    text check (trigger is null or trigger in ('user_approval','countdown_expiry')),
  decision_reason            text,
  execution_ref              text,
  version                    integer not null default 1 check (version > 0),
  updated_at                 timestamptz not null default now(),
  unique (user_did, idempotency_key),
  check (execution_deadline_at > decision_deadline_at),
  check (decision_deadline_at > created_at)
);

create index if not exists trader_proposals_user_idx
  on trader_proposals(user_did, created_at desc);
create index if not exists trader_proposals_due_idx
  on trader_proposals(status, decision_deadline_at)
  where status = 'pending';

create table if not exists trader_proposal_events (
  sequence       bigint generated always as identity primary key,
  proposal_id    uuid not null references trader_proposals(id) on delete cascade,
  user_did       text not null,
  event_type     text not null,
  event_payload  jsonb not null,
  previous_hash  text,
  event_hash     text not null unique,
  created_at     timestamptz not null default now()
);

create index if not exists trader_proposal_events_idx
  on trader_proposal_events(proposal_id, sequence);

-- Server-owned projection of devnet wallet actions. User-facing balances still come from Solana RPC.
-- One faucet idempotency key per user/day prevents duplicate mint requests and replayed HTTP calls.
create table if not exists trader_wallet_events (
  id              uuid primary key,
  user_did        text not null,
  wallet_address  text not null check (char_length(wallet_address) between 32 and 44),
  action_type     text not null check (action_type in ('faucet', 'allocate', 'withdraw')),
  amount          numeric(18,6) not null check (amount > 0),
  token_mint      text not null check (char_length(token_mint) between 32 and 44),
  cluster         text not null check (cluster = 'devnet'),
  status          text not null check (status in ('pending', 'confirmed', 'failed')),
  idempotency_key text not null unique,
  tx_signature    text,
  error_code      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists trader_wallet_events_user_idx
  on trader_wallet_events(user_did, created_at desc);

alter table trader_mandates enable row level security;
alter table trader_proposals enable row level security;
alter table trader_proposal_events enable row level security;
alter table trader_wallet_events enable row level security;
