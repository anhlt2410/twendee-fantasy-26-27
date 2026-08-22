// Sync pipeline — CLAUDE.md §7. Server-only. Guarded by CRON_SECRET.
// Idempotent: skip GWs already finished in gw_meta; recompute current GW.
import { NextResponse } from "next/server";
import pLimit from "p-limit";
import {
  getBootstrap,
  getClassicStandings,
  getEntryHistory,
  getH2HMatches,
} from "@/lib/fpl";
import { classicXp, h2hXp, ranks, type Standing } from "@/lib/penalty";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  GwScoreRow,
  H2HMatchRow,
  ManagerRow,
  PenaltyRow,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLASSIC_LEAGUE_ID = Number(process.env.CLASSIC_LEAGUE_ID);
const H2H_LEAGUE_ID = Number(process.env.H2H_LEAGUE_ID);

// per-entry per-GW extracted history
type GwHist = { gross: number; transfers: number; cost: number; net: number };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[sync] failed:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

async function sync() {
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
    const hXp = h2hXp(matchesByGw.get(gw) ?? []);

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
