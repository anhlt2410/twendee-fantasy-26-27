-- FPL Penalty Tracker — Supabase schema (CLAUDE.md §6)
-- Run in Supabase SQL editor. Idempotent-ish: drop views before recreate.

-- ─────────────────────────────── tables ───────────────────────────────
create table if not exists leagues (
  id bigint primary key,          -- classic league id
  h2h_id bigint,
  name text
);

create table if not exists managers (
  entry_id bigint primary key,
  league_id bigint references leagues(id),
  player_name text,               -- "Tên"
  entry_name text,                -- "tên FPL"
  total_points int default 0
);

create table if not exists gw_scores (
  entry_id bigint references managers(entry_id),
  event int,                      -- 1..38
  gross_points int,               -- điểm vòng đấu (chưa trừ transfer)
  transfers int,                  -- số lần transfer
  transfer_cost int,
  net_points int,                 -- điểm chuẩn (đã trừ)
  classic_rank int,               -- rank in league by net for this GW
  primary key (entry_id, event)
);

create table if not exists h2h_matches (
  event int,
  entry_1 bigint, entry_1_points int,
  entry_2 bigint, entry_2_points int,
  winner bigint,                  -- null = draw
  primary key (event, entry_1, entry_2)
);

create table if not exists penalties (
  entry_id bigint references managers(entry_id),
  event int,
  classic_xp numeric(6,2) default 0,
  h2h_xp numeric(6,2) default 0,
  total_xp numeric(6,2) generated always as (classic_xp + h2h_xp) stored,
  primary key (entry_id, event)
);

create table if not exists gw_meta (
  event int primary key,          -- sync bookkeeping
  finished boolean default false,
  synced_at timestamptz
);

-- ─────────────────────────────── RLS ───────────────────────────────
-- anon read-only; writes only via service_role (sync job)
alter table managers    enable row level security;
alter table gw_scores   enable row level security;
alter table h2h_matches enable row level security;
alter table penalties   enable row level security;
alter table gw_meta     enable row level security;

drop policy if exists r on managers;
drop policy if exists r on gw_scores;
drop policy if exists r on h2h_matches;
drop policy if exists r on penalties;
drop policy if exists r on gw_meta;
create policy r on managers    for select using (true);
create policy r on gw_scores   for select using (true);
create policy r on h2h_matches for select using (true);
create policy r on penalties   for select using (true);
create policy r on gw_meta     for select using (true);

-- ─────────────────────────────── views ───────────────────────────────
-- Overview tab
drop view if exists v_overview;
create view v_overview as
select
  m.entry_id, m.player_name, m.entry_name, m.total_points,
  rank() over (order by m.total_points desc) as position,
  coalesce(sum(p.total_xp), 0) as xp,
  count(*) filter (where gs.classic_rank = 1) as banh_mi
from managers m
left join penalties p on p.entry_id = m.entry_id
left join gw_scores gs on gs.entry_id = m.entry_id
group by m.entry_id;

-- Classic tab (filter by :event in query)
drop view if exists v_classic;
create view v_classic as
select
  gs.event, gs.entry_id, m.player_name, m.entry_name,
  gs.classic_rank as position,
  gs.gross_points, gs.transfers, gs.net_points,
  coalesce(p.total_xp, 0)   as xp,
  coalesce(p.classic_xp, 0) as classic_xp,
  coalesce(p.h2h_xp, 0)     as h2h_xp
from gw_scores gs
join managers m on m.entry_id = gs.entry_id
left join penalties p on p.entry_id = gs.entry_id and p.event = gs.event;

-- ─────────────────────────────── seed ───────────────────────────────
insert into leagues (id, h2h_id, name)
values (79247, 79400, 'FPL League')
on conflict (id) do update set h2h_id = excluded.h2h_id, name = excluded.name;
