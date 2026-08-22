// Cached Supabase reads shared across the tab layout + its pages. `cache()`
// dedupes each query within a single request render, so the hero (layout) and
// a page can both pull the same view without a second round-trip.

import { cache } from "react";
import { supabase } from "./supabase";
import type {
  ClassicRow,
  H2HMatchRow,
  ManagerName,
  OverviewRow,
} from "./types";

export const getOverview = cache(
  async () =>
    ((await supabase.from("v_overview").select("*").order("position")).data ??
      []) as OverviewRow[],
);

export const getClassic = cache(
  async () =>
    ((await supabase.from("v_classic").select("*")).data ?? []) as ClassicRow[],
);

export const getH2H = cache(
  async () =>
    ((await supabase.from("h2h_matches").select("*")).data ??
      []) as H2HMatchRow[],
);

export const getNames = cache(
  async () =>
    ((await supabase
      .from("managers")
      .select("entry_id, player_name, entry_name")).data ??
      []) as ManagerName[],
);

// GWs that have been synced (finished OR currently in progress) — i.e. GWs we
// actually hold data for. An ongoing GW has a gw_meta row with finished=false
// but live scores, so it must count as "available" for the Classic/H2H tabs.
export const getFinishedGws = cache(async () => {
  const meta = await supabase.from("gw_meta").select("event");
  return (meta.data ?? [])
    .map((r) => r.event as number)
    .sort((a, b) => a - b);
});
