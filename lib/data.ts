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

export const getOverview = cache(
  unstable_cache(
    async () =>
      ((await supabase.from("v_overview").select("*").order("position")).data ??
        []) as OverviewRow[],
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
