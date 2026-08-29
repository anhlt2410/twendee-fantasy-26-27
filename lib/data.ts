// Cached Supabase reads shared across the tab layout + its pages.
//
// Two cache layers:
//  - `unstable_cache(..., { tags: [FPL_TAG] })` caches the query result ACROSS
//    requests (ISR-like) but is bustable by tag. The sync action calls
//    `revalidateTag(FPL_TAG)` so EVERY tab reads fresh data right after a sync —
//    supabase-js fetches aren't path-tagged, so revalidatePath alone missed
//    them; the explicit tag makes invalidation reliable across all routes.
//  - `cache(...)` dedupes each query within a single request render, so the hero
//    (layout) and a page can both pull the same view without a second round-trip.

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type {
  ClassicRow,
  H2HMatchRow,
  ManagerName,
  OverviewRow,
} from "./types";

// Bust with revalidateTag(FPL_TAG) after a sync to refresh all tabs at once.
export const FPL_TAG = "fpl-data";

// keep a soft ISR window as a safety net for the hourly cron path
const opts = { tags: [FPL_TAG], revalidate: 120 };

// Overview aggregation done in-app instead of via the v_overview VIEW. That view
// joins penalties and gw_scores to managers on entry_id alone, producing a
// cartesian product (one penalty row per gw_scores row) that multiplies XP and
// bánh mì by the number of synced GWs. Aggregating each table separately here
// keeps the totals correct without depending on a DB migration.
export const getOverview = cache(
  unstable_cache(
    async () => {
      const [managers, penalties, scores] = await Promise.all([
        supabase
          .from("managers")
          .select("entry_id, player_name, entry_name, total_points"),
        supabase.from("penalties").select("entry_id, total_xp"),
        supabase.from("gw_scores").select("entry_id, classic_rank"),
      ]);

      const xpByEntry = new Map<number, number>();
      for (const p of penalties.data ?? [])
        xpByEntry.set(
          p.entry_id,
          (xpByEntry.get(p.entry_id) ?? 0) + Number(p.total_xp),
        );

      const banhMiByEntry = new Map<number, number>();
      for (const s of scores.data ?? [])
        if (s.classic_rank === 1)
          banhMiByEntry.set(s.entry_id, (banhMiByEntry.get(s.entry_id) ?? 0) + 1);

      const rows = (managers.data ?? [])
        .map((m) => ({
          entry_id: m.entry_id,
          player_name: m.player_name,
          entry_name: m.entry_name,
          total_points: m.total_points,
          xp: xpByEntry.get(m.entry_id) ?? 0,
          banh_mi: banhMiByEntry.get(m.entry_id) ?? 0,
        }))
        .sort((a, b) => b.total_points - a.total_points);

      // standard competition rank: ties share position (1,2,2,4…)
      let position = 0;
      return rows.map((r, i) => {
        if (i === 0 || r.total_points !== rows[i - 1].total_points)
          position = i + 1;
        return { ...r, position };
      }) as OverviewRow[];
    },
    ["overview"],
    opts,
  ),
);

export const getClassic = cache(
  unstable_cache(
    async () =>
      ((await supabase.from("v_classic").select("*")).data ??
        []) as ClassicRow[],
    ["classic"],
    opts,
  ),
);

export const getH2H = cache(
  unstable_cache(
    async () =>
      ((await supabase.from("h2h_matches").select("*")).data ??
        []) as H2HMatchRow[],
    ["h2h"],
    opts,
  ),
);

export const getNames = cache(
  unstable_cache(
    async () =>
      ((await supabase
        .from("managers")
        .select("entry_id, player_name, entry_name")).data ??
        []) as ManagerName[],
    ["names"],
    opts,
  ),
);

// GWs that have been synced (finished OR currently in progress) — i.e. GWs we
// actually hold data for. An ongoing GW has a gw_meta row with finished=false
// but live scores, so it must count as "available" for the Classic/H2H tabs.
export const getFinishedGws = cache(
  unstable_cache(
    async () => {
      const meta = await supabase.from("gw_meta").select("event");
      return (meta.data ?? [])
        .map((r) => r.event as number)
        .sort((a, b) => a - b);
    },
    ["finished-gws"],
    opts,
  ),
);
