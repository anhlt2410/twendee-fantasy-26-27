// Shared types. FPL raw shapes live here; fetchers in lib/fpl.ts.

// ─────────────── FPL API raw shapes (only fields we use) ───────────────
export type FplEvent = {
  id: number;
  finished: boolean;
  is_current: boolean;
};

export type FplBootstrap = {
  events: FplEvent[];
};

export type FplStandingRow = {
  entry: number; // entry_id
  entry_name: string; // "tên FPL"
  player_name: string; // "Tên"
  total: number; // total points
};

// Pre-season, the roster lives under `new_entries` (standings is empty until
// GW1 finishes). Name is split; no total yet.
export type FplNewEntryRow = {
  entry: number;
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
};

export type FplClassicStandings = {
  standings: {
    has_next: boolean;
    page: number;
    results: FplStandingRow[];
  };
  new_entries: {
    has_next: boolean;
    page: number;
    results: FplNewEntryRow[];
  };
};

export type FplHistoryEntry = {
  event: number;
  points: number; // gross GW score (before hit)
  event_transfers: number;
  event_transfers_cost: number;
};

export type FplEntryHistory = {
  current: FplHistoryEntry[];
};

export type FplH2HMatch = {
  event: number;
  entry_1_entry: number | null;
  entry_1_points: number;
  entry_2_entry: number | null;
  entry_2_points: number;
  winner: number | null;
};

export type FplH2HMatches = {
  has_next: boolean;
  page: number;
  results: FplH2HMatch[];
};

// ─────────────── DB row shapes ───────────────
export type ManagerRow = {
  entry_id: number;
  league_id: number;
  player_name: string;
  entry_name: string;
  total_points: number;
};

export type GwScoreRow = {
  entry_id: number;
  event: number;
  gross_points: number;
  transfers: number;
  transfer_cost: number;
  net_points: number;
  classic_rank: number;
};

export type H2HMatchRow = {
  event: number;
  entry_1: number | null;
  entry_1_points: number;
  entry_2: number | null;
  entry_2_points: number;
  winner: number | null;
};

export type PenaltyRow = {
  entry_id: number;
  event: number;
  classic_xp: number;
  h2h_xp: number;
};

// ─────────────── View shapes (frontend reads these) ───────────────
export type OverviewRow = {
  entry_id: number;
  player_name: string;
  entry_name: string;
  total_points: number;
  position: number;
  xp: number;
  banh_mi: number;
};

export type ClassicRow = {
  event: number;
  entry_id: number;
  player_name: string;
  entry_name: string;
  position: number;
  gross_points: number;
  transfers: number;
  net_points: number;
  xp: number;
  classic_xp: number;
  h2h_xp: number;
};
