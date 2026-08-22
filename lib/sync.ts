// Sync pipeline core — CLAUDE.md §7. Server-only. Pulls FPL → computes XP →
// upserts Supabase. Idempotent: skip GWs already finished in gw_meta; recompute
// the current GW. Shared by the cron route (GET /api/sync) and the manual
// "Đồng bộ từ FPL" server action.
import pLimit from "p-limit";
import {
  getBootstrap,
  getClassicStandings,
  getEntryHistory,
  getEntryPicks,
  getH2HMatches,
  getLivePoints,
} from "./fpl";
import { classicXp, h2hXp, ranks, type Standing } from "./penalty";
import { supabaseAdmin } from "./supabase";
import type { GwScoreRow, H2HMatchRow, ManagerRow, PenaltyRow } from "./types";

const CLASSIC_LEAGUE_ID = Number(process.env.CLASSIC_LEAGUE_ID);
const H2H_LEAGUE_ID = Number(process.env.H2H_LEAGUE_ID);

// per-entry per-GW extracted history
type GwHist = { gross: number; transfers: number; cost: number; net: number };

export async function runSync() {
  const db = supabaseAdmin();

  // 1. bootstrap → finished + current GWs
  const bootstrap = await getBootstrap();
  const finishedIds = new Set(
    bootstrap.events.filter((e) => e.finished).map((e) => e.id),
  );
  const currentGw = bootstrap.events.find((e) => e.is_current)?.id ?? null;

  // 2. classic standings → managers
  const standingsRows = await getClassicStandings(CLASSIC_LEAGUE_ID);
  const managers: ManagerRow[] = standingsRows.map((r) => ({
    entry_id: r.entry,
    league_id: CLASSIC_LEAGUE_ID,
    player_name: r.player_name,
    entry_name: r.entry_name,
    total_points: r.total,
  }));
  if (managers.length) {
    const { error } = await db
      .from("managers")
      .upsert(managers, { onConflict: "entry_id" });
    if (error) throw new Error(`managers upsert: ${error.message}`);
  }

  // 3. H2H matches (all pages) → store + group by GW. Done BEFORE the
  // early-return below so the full 38-GW fixture schedule is pulled even
  // pre-season, when no GW is finished/current yet.
  const rawMatches = await getH2HMatches(H2H_LEAGUE_ID);
  const h2hRows: H2HMatchRow[] = rawMatches.map((m) => ({
    event: m.event,
    entry_1: m.entry_1_entry ?? 0, // 0 = AVERAGE sentinel (PK cannot be null)
    entry_1_points: m.entry_1_points,
    entry_2: m.entry_2_entry ?? 0,
    entry_2_points: m.entry_2_points,
    winner: m.winner,
  }));
  if (h2hRows.length) {
    const { error } = await db
      .from("h2h_matches")
      .upsert(h2hRows, { onConflict: "event,entry_1,entry_2" });
    if (error) throw new Error(`h2h upsert: ${error.message}`);
  }
  // raw (null-preserving) matches grouped by GW — for h2hXp (AVERAGE = null).
  // Result is derived from points, so carry both sides' points through.
  const matchesByGw = new Map<
    number,
    {
      entry1: number | null;
      entry2: number | null;
      points1: number;
      points2: number;
    }[]
  >();
  for (const m of rawMatches) {
    const arr = matchesByGw.get(m.event) ?? [];
    arr.push({
      entry1: m.entry_1_entry,
      entry2: m.entry_2_entry,
      points1: m.entry_1_points,
      points2: m.entry_2_points,
    });
    matchesByGw.set(m.event, arr);
  }

  // 4. GWs to process = (finished || current) not already finalized in gw_meta
  const { data: metaRows, error: metaErr } = await db
    .from("gw_meta")
    .select("event, finished")
    .eq("finished", true);
  if (metaErr) throw new Error(`gw_meta read: ${metaErr.message}`);
  const alreadyFinished = new Set((metaRows ?? []).map((r) => r.event));

  const candidates = bootstrap.events
    .filter((e) => e.finished || e.is_current)
    .map((e) => e.id);
  const targetGws = candidates
    .filter((id) => !alreadyFinished.has(id))
    .sort((a, b) => a - b);

  if (!targetGws.length) {
    return {
      processedGws: [],
      currentGw,
      managers: managers.length,
      h2hMatches: h2hRows.length,
      note: "no GW to compute; H2H schedule synced",
    };
  }

  // 5. per-manager history (batched, p-limit 5)
  const limit = pLimit(5);
  const histByEntry = new Map<number, Map<number, GwHist>>();
  await Promise.all(
    managers.map((m) =>
      limit(async () => {
        const hist = await getEntryHistory(m.entry_id);
        const byGw = new Map<number, GwHist>();
        for (const h of hist.current) {
          byGw.set(h.event, {
            gross: h.points,
            transfers: h.event_transfers,
            cost: h.event_transfers_cost,
            net: h.points - h.event_transfers_cost,
          });
        }
        histByEntry.set(m.entry_id, byGw);
      }),
    ),
  );

  // 5b. LIVE fix for the in-progress GW. The entry/history (and picks
  // entry_history) `points` LAG during a live GW — they only finalize after the
  // GW is data_checked — so bench-boost / captaincy live scores are wrong there
  // (e.g. history says 20 while the league standings show 50). Recompute the
  // current GW's gross from event/{gw}/live × each manager's picks multipliers
  // (bench-boost sets bench multiplier to 1, captain 2, TC 3), then override the
  // lagging history value. Transfers/cost are locked at deadline → keep those.
  const liveGw = targetGws.find((gw) => !finishedIds.has(gw));
  if (liveGw != null) {
    const livePts = await getLivePoints(liveGw);
    await Promise.all(
      managers.map((m) =>
        limit(async () => {
          try {
            const picks = await getEntryPicks(m.entry_id, liveGw);
            let gross = 0;
            for (const p of picks.picks) {
              gross += (livePts.get(p.element) ?? 0) * p.multiplier;
            }
            const byGw = histByEntry.get(m.entry_id);
            const prev = byGw?.get(liveGw);
            const cost =
              picks.entry_history.event_transfers_cost ?? prev?.cost ?? 0;
            const transfers =
              picks.entry_history.event_transfers ?? prev?.transfers ?? 0;
            byGw?.set(liveGw, {
              gross,
              transfers,
              cost,
              net: gross - cost,
            });
          } catch {
            // leave the history-derived value in place if picks/live fail
          }
        }),
      ),
    );
  }

  // 6. per GW → compute + upsert gw_scores + penalties
  for (const gw of targetGws) {
    const standings: Standing[] = [];
    for (const m of managers) {
      const h = histByEntry.get(m.entry_id)?.get(gw);
      if (h) standings.push({ entryId: m.entry_id, net: h.net });
    }
    if (!standings.length) continue; // GW not played by anyone yet

    const cXp = classicXp(standings);
    const rank = ranks(standings);

    // H2H uses each manager's NET points (from gw_scores/history) as the single
    // source of truth — NOT the FPL H2H API's entry_x_points/winner, which stay
    // 0/null until the GW is finalized. For an AVERAGE opponent (entry null/0)
    // there's no history, so fall back to the API-provided average score.
    const netForH2H = (id: number | null, apiPts: number) =>
      id != null && id !== 0
        ? (histByEntry.get(id)?.get(gw)?.net ?? apiPts)
        : apiPts;
    const h2hResults = (matchesByGw.get(gw) ?? []).map((f) => ({
      entry1: f.entry1,
      entry2: f.entry2,
      points1: netForH2H(f.entry1, f.points1),
      points2: netForH2H(f.entry2, f.points2),
    }));
    const hXp = h2hXp(h2hResults);

    const scoreRows: GwScoreRow[] = [];
    const penaltyRows: PenaltyRow[] = [];
    for (const s of standings) {
      const h = histByEntry.get(s.entryId)!.get(gw)!;
      scoreRows.push({
        entry_id: s.entryId,
        event: gw,
        gross_points: h.gross,
        transfers: h.transfers,
        transfer_cost: h.cost,
        net_points: h.net,
        classic_rank: rank.get(s.entryId)!,
      });
      penaltyRows.push({
        entry_id: s.entryId,
        event: gw,
        classic_xp: cXp.get(s.entryId) ?? 0,
        h2h_xp: hXp.get(s.entryId) ?? 0,
      });
    }

    const { error: sErr } = await db
      .from("gw_scores")
      .upsert(scoreRows, { onConflict: "entry_id,event" });
    if (sErr) throw new Error(`gw_scores upsert (gw ${gw}): ${sErr.message}`);

    const { error: pErr } = await db
      .from("penalties")
      .upsert(penaltyRows, { onConflict: "entry_id,event" });
    if (pErr) throw new Error(`penalties upsert (gw ${gw}): ${pErr.message}`);

    // Overwrite this GW's H2H rows with net-based scores + our own winner
    // (derived from net), so the H2H tab matches the classic net points and
    // shows a live result while the GW is still in progress.
    const h2hUpdates: H2HMatchRow[] = h2hResults.map((r) => ({
      event: gw,
      entry_1: r.entry1 ?? 0,
      entry_1_points: r.points1,
      entry_2: r.entry2 ?? 0,
      entry_2_points: r.points2,
      winner:
        r.points1 === r.points2
          ? null
          : r.points1 > r.points2
            ? (r.entry1 ?? 0)
            : (r.entry2 ?? 0),
    }));
    if (h2hUpdates.length) {
      const { error: hErr } = await db
        .from("h2h_matches")
        .upsert(h2hUpdates, { onConflict: "event,entry_1,entry_2" });
      if (hErr) throw new Error(`h2h upsert (gw ${gw}): ${hErr.message}`);
    }
  }

  // 7. mark gw_meta.finished per bootstrap
  const now = new Date().toISOString();
  const metaUpserts = targetGws.map((gw) => ({
    event: gw,
    finished: finishedIds.has(gw),
    synced_at: now,
  }));
  const { error: mErr } = await db
    .from("gw_meta")
    .upsert(metaUpserts, { onConflict: "event" });
  if (mErr) throw new Error(`gw_meta upsert: ${mErr.message}`);

  return {
    processedGws: targetGws,
    currentGw,
    managers: managers.length,
    h2hMatches: h2hRows.length,
  };
}
