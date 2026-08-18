# CLAUDE.md — FPL Penalty Tracker

Single source of truth for this project. Read fully before writing code. Domain
logic (XP rules) is **exact and locked** — do not reinterpret.

---

## 1. What this is

Public, no-auth web app for a private FPL league. Pulls Classic + H2H data from
the FPL API, applies a custom **penalty (XP)** system, and displays it across 3
tabs. Mobile-first (primary usage is phone). Low latency is a hard requirement.

**League IDs (this league):** `CLASSIC_LEAGUE_ID=79247`, `H2H_LEAGUE_ID=79400`.
Seed the `leagues` row with these; also set them in `.env`.

---

## 2. Stack & deployment

- Next.js 15 (App Router, RSC) + TypeScript
- Tailwind CSS
- Supabase (Postgres + `supabase-js`)
- Deployed on Vercel; sync via **Vercel Cron**
- `pnpm` package manager

---

## 3. Architecture — non-negotiable

FPL API **blocks CORS** → never call it from the browser. Data for finished
gameweeks is **immutable** → compute once, store in Supabase, serve reads from
Supabase only.

```
Vercel Cron ──► /api/sync (server, service_role key, no CORS)
                  ├─ bootstrap-static      → events[]: which GW finished/current
                  ├─ leagues-classic/{id}  → roster of entries
                  ├─ entry/{id}/history    → per-GW points (N calls, batched)
                  ├─ leagues-h2h-matches   → H2H schedule + results
                  ├─ compute net, classic_rank, XP, bánh mì
                  └─ upsert Supabase
Frontend (RSC / supabase-js) ──► read pre-computed VIEWs ──► render
```

**Read path = Supabase only.** No FPL calls, no aggregation client-side.
**Idempotency:** persist a `finished` flag per GW; skip GWs already synced.
Each cron run only recomputes the current (unfinished) GW.

---

## 4. FPL API reference

Base: `https://fantasy.premierleague.com/api`

| Purpose | Endpoint | Notes |
|---|---|---|
| Which GW finished/current | `/bootstrap-static/` | `events[]` → `finished`, `is_current`, `id` |
| Classic roster + totals | `/leagues-classic/{id}/standings/` | paginated: `standings.has_next`, `?page_standings=n` |
| Per-manager per-GW points | `/entry/{entry_id}/history/` | `current[]` array |
| H2H schedule + results | `/leagues-h2h-matches/league/{id}/` | paginated: `has_next`, `?page=n` |

`history.current[]` fields used:
- `points` = **gross** GW score (before transfer hit) → *"điểm vòng đấu"*
- `event_transfers` → *"số lần transfer"*
- `event_transfers_cost` → hit deducted
- **net** = `points - event_transfers_cost` → *"điểm chuẩn"*

`leagues-h2h-matches` per match: `event`, `entry_1_entry`, `entry_1_points`,
`entry_2_entry`, `entry_2_points`, `winner` (entry id, `null` = draw).
**AVERAGE opponent** (when league has odd manager count): its `entry_x_entry` is
`null` / not in the manager set → real manager still penalized per result;
AVERAGE receives no penalty.

### Gotchas (production)
- **403 from datacenter IPs:** Vercel server fetch may be blocked without a
  browser `User-Agent`. Always send `{ 'User-Agent': 'Mozilla/5.0 ...' }`.
- **Rate limit:** ~15–20 history calls is fine, but batch with `p-limit` (5).
- **Off-season format changes:** FPL occasionally changes call formats in summer.
  Validate one entry's `points` vs the FPL UI on first sync of a new season.

---

## 5. Domain logic — XP (LOCKED, exact)

Two independent penalties per GW, summed → total XP. XP can be fractional
(tie-split) → store as `numeric`.

### Classic XP (per GW)
Sort managers by **net** desc → slot 1..N. Penalize the lower half; when N is
odd the **median is penalized** (`ceil`).
- `numPenalized = ceil(N/2)`, `start = N - numPenalized + 1`
- slotP(slot) = `slot < start ? 0 : (slot - start + 1) * 10`
- N=10 → slots 6..10 = 10,20,30,40,50
- N=11 → slots 6..11 = 10,20,30,40,50,60 (slot 6 = median, penalized)

**Tie-split (one formula, all cases):** each member of an equal-net group gets
`(sum of the group's slot-penalties) / (group size)`. Safe slots contribute 0,
so "at least one penalized member" is handled automatically.
- slots 6&7 tie → (10+20)/2 = 15 each
- slots 5(safe)&6 tie → (0+10)/2 = 5 each

### H2H XP (per GW)
Loss = **10**, draw = **5** each, win = 0.

### Total
`total_xp = classic_xp + h2h_xp`, accumulated across all finished GWs.

### Reference implementation — `lib/penalty.ts`
Do not rewrite these. Wire them into the sync as-is.

```typescript
export type Standing = { entryId: number; net: number };

// CLASSIC XP for one GW
export function classicXp(standings: Standing[], step = 10): Map<number, number> {
  const N = standings.length;
  const numPenalized = Math.ceil(N / 2);        // odd N → median penalized
  const start = N - numPenalized + 1;
  const sorted = [...standings].sort((a, b) => b.net - a.net);
  const slotP = (slot: number) => (slot < start ? 0 : (slot - start + 1) * step);

  const xp = new Map<number, number>();
  for (let i = 0; i < N; ) {
    let j = i;
    while (j < N && sorted[j].net === sorted[i].net) j++; // equal-net group [i,j)
    let pool = 0;
    for (let s = i + 1; s <= j; s++) pool += slotP(s);    // slot is 1-indexed
    const share = pool / (j - i);
    for (let k = i; k < j; k++) xp.set(sorted[k].entryId, share);
    i = j;
  }
  return xp;
}

// H2H XP for one GW. matches: real-manager side(s) only; AVERAGE = null entry.
export function h2hXp(
  matches: { entry1: number | null; entry2: number | null; winner: number | null }[],
  loss = 10, draw = 5,
): Map<number, number> {
  const xp = new Map<number, number>();
  const add = (id: number | null, v: number) => { if (id != null) xp.set(id, (xp.get(id) ?? 0) + v); };
  for (const m of matches) {
    if (m.winner === null) { add(m.entry1, draw); add(m.entry2, draw); }
    else add(m.winner === m.entry1 ? m.entry2 : m.entry1, loss);
  }
  return xp;
}

// Standard competition rank (ties share rank) — for classic_rank + bánh mì
export function ranks(standings: Standing[]): Map<number, number> {
  const sorted = [...standings].sort((a, b) => b.net - a.net);
  const r = new Map<number, number>();
  sorted.forEach((s, i) => {
    r.set(s.entryId, i > 0 && s.net === sorted[i - 1].net
      ? r.get(sorted[i - 1].entryId)! : i + 1);
  });
  return r;
}
```

**bánh mì** = count of GWs where `classic_rank === 1` (tie at top → both counted).

---

## 6. Supabase schema

```sql
create table leagues (
  id bigint primary key,          -- classic league id
  h2h_id bigint,
  name text
);

create table managers (
  entry_id bigint primary key,
  league_id bigint references leagues(id),
  player_name text,               -- "Tên"
  entry_name text,                -- "tên FPL"
  total_points int default 0
);

create table gw_scores (
  entry_id bigint references managers(entry_id),
  event int,                      -- 1..38
  gross_points int,               -- điểm vòng đấu (chưa trừ transfer)
  transfers int,                  -- số lần transfer
  transfer_cost int,
  net_points int,                 -- điểm chuẩn (đã trừ)
  classic_rank int,               -- rank in league by net for this GW
  primary key (entry_id, event)
);

create table h2h_matches (
  event int,
  entry_1 bigint, entry_1_points int,
  entry_2 bigint, entry_2_points int,
  winner bigint,                  -- null = draw
  primary key (event, entry_1, entry_2)
);

create table penalties (
  entry_id bigint references managers(entry_id),
  event int,
  classic_xp numeric(6,2) default 0,
  h2h_xp numeric(6,2) default 0,
  total_xp numeric(6,2) generated always as (classic_xp + h2h_xp) stored,
  primary key (entry_id, event)
);

create table gw_meta (
  event int primary key,          -- sync bookkeeping
  finished boolean default false,
  synced_at timestamptz
);

-- RLS: anon read-only; writes only via service_role (sync job)
alter table managers   enable row level security;
alter table gw_scores  enable row level security;
alter table h2h_matches enable row level security;
alter table penalties  enable row level security;
alter table gw_meta    enable row level security;
create policy r on managers    for select using (true);
create policy r on gw_scores   for select using (true);
create policy r on h2h_matches for select using (true);
create policy r on penalties   for select using (true);
create policy r on gw_meta     for select using (true);
```

### Pre-joined VIEWs (frontend never aggregates)

```sql
-- Overview tab
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
```

---

## 7. Sync pipeline — `app/api/sync/route.ts`

Server route (or Vercel Cron target). Steps:

1. Fetch `bootstrap-static` → determine finished + current GWs.
2. Fetch classic standings (all pages) → upsert `managers`, `total_points`.
3. Determine GWs to process = current GW + any finished GW missing in `gw_meta`.
   Skip GWs already `finished=true`.
4. For each manager: fetch `entry/{id}/history` (batch with `p-limit(5)`,
   `User-Agent` header). Extract per-GW `points`, `event_transfers`,
   `event_transfers_cost`; compute `net`.
5. Fetch `leagues-h2h-matches` (all pages) → upsert `h2h_matches`, group by GW.
6. Per GW:
   ```typescript
   const standings = managers.map(m => ({ entryId: m.entry_id, net: netOf(m, gw) }));
   const cXp  = classicXp(standings);
   const rank = ranks(standings);
   const hXp  = h2hXp(matchesByGw.get(gw) ?? []);
   // upsert gw_scores (incl. classic_rank), penalties (classic_xp, h2h_xp)
   ```
7. Mark `gw_meta.finished` for GWs whose `events[].finished === true`.

Batch upserts. Idempotent: safe to re-run any time.

---

## 8. Frontend — 3 tabs

Read from VIEWs via `supabase-js`. Mobile-first, **minimize vertical scroll**.

### Overview
Table, 6 cols, fits mobile width:
`Vị trí | Tên | tên FPL | điểm | XP | bánh mì(🥖)`
Source: `v_overview` ordered by `position`. Sticky header, numbers right-aligned,
color badge for top / bottom.

### Classic
GW filter (dropdown 1–38). If selected GW not `finished` (check `gw_meta`) →
render **"Vòng đấu chưa diễn ra"**, no table.
9 cols — too wide for phone. **Sticky left 2 cols** (`Vị trí` + `Tên`) +
**horizontal scroll** for the numeric block. Keeps it one screen tall.
Columns:
`Vị trí | Tên | tên FPL | điểm vòng đấu | số lần transfer | điểm chuẩn | XP | Classic | H2H`
Maps to `v_classic` (`gross_points, transfers, net_points, xp, classic_xp, h2h_xp`).
Abbreviate headers + tooltip.

### H2H
Fixtures grouped by GW, FPL-style card per match: two rows (name + score),
winner highlighted, draw neutral. Same GW filter behavior as Classic.
Source: `h2h_matches` joined to `managers` for names.

### Visual
Sport-modern, FPL-inspired. Palette:
- purple `#37003c`, magenta `#e90052`, cyan-green `#00ff87`, cyan `#04f5ff`
- header gradient `linear-gradient(135deg,#37003c,#e90052)`, accent `#00ff87`
- gradient accents, high data density, no wasted whitespace

---

## 9. Build order (MVP)

1. Supabase project → run schema (§6) → seed `leagues`:
   `insert into leagues (id, h2h_id, name) values (79247, 79400, 'FPL League');`
2. `lib/penalty.ts` (§5) + `lib/fpl.ts` (typed fetchers, User-Agent, pagination).
3. `app/api/sync/route.ts` (§7). Run manually, verify data. Then attach cron.
4. Frontend 3 tabs (§8) reading VIEWs. Ship.
5. `vercel.json` cron: hourly during match windows, daily off-season.

---

## 10. Env & commands

```
NEXT_PUBLIC_SUPABASE_URL=https://qtkftkbnwispnnvgaseq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0a2Z0a2Jud2lzcG5udmdhc2VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NTM5MzgsImV4cCI6MjEwMjUyOTkzOH0.w9Mx64zZ3OHa9t--_fTD3WXP72Mn4ZFFA0Fc_Vim724      # read-only via RLS
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0a2Z0a2Jud2lzcG5udmdhc2VxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk1MzkzOCwiZXhwIjoyMTAyNTI5OTM4fQ.XtFKVuNzfN5kIdnqon4OIQoGnFNaX0MLiwwZxSGR-4I          # server sync only, never client
CLASSIC_LEAGUE_ID=79247
H2H_LEAGUE_ID=79400
CRON_SECRET=                        # guard /api/sync
```

```bash
pnpm dev
pnpm build
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/sync  # manual sync
```

## Conventions
- Scoped, iterative edits — no full-file rewrites.
- Concise, production-minded: error handling, batching, idempotency.
- Types in `lib/types.ts`; FPL fetchers isolated in `lib/fpl.ts`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
