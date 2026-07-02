-- WHISTL — Supabase schema. Run this in the Supabase SQL Editor.
--
-- Security model (zero-trust): the BROWSER never writes directly. All writes go through
-- Next.js server routes that FIRST verify the caller's Privy access token. RLS denies all
-- writes to anon/authenticated; the server uses the service-role key (which bypasses RLS)
-- and scopes every operation to the verified Privy identity. Open pacts are publicly readable.

create extension if not exists "pgcrypto";

-- One row per Privy identity.
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  privy_did     text unique not null,
  wallet        text,
  email         text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- Off-chain index of on-chain pacts (the chain is the source of truth for funds).
create table if not exists public.pacts (
  id                  uuid primary key default gen_random_uuid(),
  pact_id             numeric not null,
  pact_pda            text unique,
  fixture_id          bigint not null,
  competition         text,
  match_label         text,
  statement           text not null,
  terms               jsonb not null,
  stake_usdc          numeric not null,
  creator_did         text not null references public.users(privy_did),
  creator_wallet      text,
  counterparty_did    text references public.users(privy_did),
  counterparty_wallet text,
  status              text not null default 'created'
                        check (status in ('created','accepted','settled','cancelled')),
  winner_did          text,
  tx_create           text,
  tx_accept           text,
  tx_settle           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pacts_status_idx  on public.pacts (status);
create index if not exists pacts_fixture_idx on public.pacts (fixture_id);

-- Lock everything down. anon/authenticated get NO access by default.
-- The service-role key (used only on our server, after verifying the Privy token) bypasses RLS.
alter table public.users enable row level security;
alter table public.pacts enable row level security;

-- The only client-facing allowance: anyone may READ pacts (markets are public). Writes stay server-only.
drop policy if exists "pacts are publicly readable" on public.pacts;
create policy "pacts are publicly readable" on public.pacts for select using (true);
