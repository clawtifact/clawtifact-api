-- ============================================================
--  CLAWTIFACT — Supabase schema
--  Run this in the Supabase SQL editor once.
--  The API connects with the service_role key (bypasses RLS).
-- ============================================================

-- ---- transmissions feed ----
create table if not exists clawtifact_transmissions (
  id          uuid primary key default gen_random_uuid(),
  signal_id   text not null,
  seed        bigint not null,
  input       text not null,
  lines       jsonb not null,
  source      text not null default 'model',   -- 'model' | 'fallback'
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_clawtifact_tx_created
  on clawtifact_transmissions (created_at desc);

-- Lock the table down: only the service_role (used by the API) can touch it.
-- The public feed is served *through* the API, not directly from the browser.
alter table clawtifact_transmissions enable row level security;
-- (no anon policies on purpose — service_role bypasses RLS)

-- ---- per-IP daily quota ----
create table if not exists clawtifact_quota (
  ip_hash  text not null,
  day      date not null default current_date,
  count    int  not null default 0,
  primary key (ip_hash, day)
);
alter table clawtifact_quota enable row level security;

-- Atomically increment today's counter for an IP and return how many calls remain.
--   return >= 0  -> request allowed (and counted)
--   return <  0  -> over quota
create or replace function clawtifact_check_quota(p_ip text, p_max int)
returns int
language plpgsql
security definer
as $$
declare
  cur int;
begin
  insert into clawtifact_quota (ip_hash, day, count)
  values (p_ip, current_date, 1)
  on conflict (ip_hash, day)
  do update set count = clawtifact_quota.count + 1
  returning count into cur;

  return p_max - cur;
end;
$$;

-- Optional housekeeping: prune quota rows older than 7 days.
-- delete from clawtifact_quota where day < current_date - 7;
