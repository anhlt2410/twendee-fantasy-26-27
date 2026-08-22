// FPL API fetchers — isolated here. Always send a browser User-Agent
// (datacenter IPs get 403 without it). Handle pagination. See CLAUDE.md §4.
import type {
  FplBootstrap,
  FplClassicStandings,
  FplEntryHistory,
  FplH2HMatch,
  FplH2HMatches,
  FplLive,
  FplPicks,
  FplStandingRow,
} from "./types";

const BASE = "https://fantasy.premierleague.com/api";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function fplGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FPL ${path} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getBootstrap(): Promise<FplBootstrap> {
  return fplGet<FplBootstrap>("/bootstrap-static/");
}

// Classic standings — paginated via standings.has_next / ?page_standings=n.
// Pre-season fallback: standings is empty until GW1 finishes, so read the
// roster from `new_entries` (name split → joined, total → 0).
export async function getClassicStandings(
  leagueId: number,
): Promise<FplStandingRow[]> {
  const rows: FplStandingRow[] = [];
  let page = 1;
  for (;;) {
    const data = await fplGet<FplClassicStandings>(
      `/leagues-classic/${leagueId}/standings/?page_standings=${page}&page_new_entries=${page}`,
    );
    rows.push(...data.standings.results);
    if (rows.length === 0) {
      rows.push(
        ...data.new_entries.results.map((n) => ({
          entry: n.entry,
          entry_name: n.entry_name,
          player_name: `${n.player_first_name} ${n.player_last_name}`.trim(),
          total: 0,
        })),
      );
      if (!data.new_entries.has_next) break;
    } else if (!data.standings.has_next) break;
    page++;
  }
  return rows;
}

export function getEntryHistory(entryId: number): Promise<FplEntryHistory> {
  return fplGet<FplEntryHistory>(`/entry/${entryId}/history/`);
}

// Live element points for a GW → Map<elementId, total_points>. Used to compute
// a manager's live gross for an in-progress GW (history lags until finalized).
export async function getLivePoints(gw: number): Promise<Map<number, number>> {
  const data = await fplGet<FplLive>(`/event/${gw}/live/`);
  return new Map(data.elements.map((e) => [e.id, e.stats.total_points]));
}

export function getEntryPicks(entryId: number, gw: number): Promise<FplPicks> {
  return fplGet<FplPicks>(`/entry/${entryId}/event/${gw}/picks/`);
}

// H2H matches — paginated via has_next / ?page=n
export async function getH2HMatches(leagueId: number): Promise<FplH2HMatch[]> {
  const rows: FplH2HMatch[] = [];
  let page = 1;
  for (;;) {
    const data = await fplGet<FplH2HMatches>(
      `/leagues-h2h-matches/league/${leagueId}/?page=${page}`,
    );
    rows.push(...data.results);
    if (!data.has_next) break;
    page++;
  }
  return rows;
}
