// Sổ đầu bài — season-long achievements (praise + troll), computed server-side
// from data already fetched for the page (v_overview, v_classic, h2h_matches).
// Pure + synchronous: no DB round-trip, runs inside the ISR-cached RSC render.

import type { ClassicRow, H2HMatchRow, OverviewRow } from "./types";

export type AchWinner = {
  entry_id: number;
  player_name: string;
  entry_name: string;
};

export type Achievement = {
  key: string;
  emoji: string;
  title: string;
  tone: "praise" | "troll";
  accent: string; // hex, drives the card's --accent
  winners: AchWinner[];
  value: string; // formatted headline number
  unit: string; // caption under the number
};

// palette (matches tailwind sea tokens + a few extras)
const EMERALD = "#34d399";
const TEAL = "#2dd4bf";
const CYAN = "#38bdf8";
const ROSE = "#fb7185";
const AMBER = "#fbbf24";
const VIOLET = "#a78bfa";

// ─────────────── per-manager aggregates ───────────────
type MStat = {
  entry_id: number;
  played: number;
  sumNet: number;
  avgNet: number;
  sumTransfers: number;
  sumCost: number; // total transfer hits (points deducted)
  maxGwGross: number;
  minGwNet: number;
  bestHitNet: number; // best net in a GW where a hit was paid; -Inf if none
  maxGwCost: number; // biggest single-GW hit
  lastPlaceWeeks: number;
  secondPlaceWeeks: number;
  streakTop3: number;
  posStdev: number;
  firstEvent: number;
  firstGwGross: number;
  firstGwRank: number;
  // from overview
  banhMi: number;
  totalXp: number;
  totalPoints: number;
  // h2h
  wins: number;
  losses: number;
  draws: number;
};

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

// longest run of consecutive rows (by event order) satisfying pred
function longestStreak<T>(rows: T[], pred: (r: T) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const r of rows) {
    cur = pred(r) ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

function buildStats(
  overview: OverviewRow[],
  classic: ClassicRow[],
  h2h: H2HMatchRow[],
): { stats: MStat[]; rankDelta: Map<number, number> } {
  // per-event bottom position (competition rank → last = max position that GW)
  const eventMaxPos = new Map<number, number>();
  for (const r of classic) {
    const cur = eventMaxPos.get(r.event) ?? 0;
    if (r.position > cur) eventMaxPos.set(r.event, r.position);
  }

  // group classic rows by manager, ascending by event
  const byMgr = new Map<number, ClassicRow[]>();
  for (const r of classic) {
    const arr = byMgr.get(r.entry_id) ?? [];
    arr.push(r);
    byMgr.set(r.entry_id, arr);
  }
  for (const arr of byMgr.values()) arr.sort((a, b) => a.event - b.event);

  // h2h W/L/D per entry (skip AVERAGE / null sides)
  const h2hRec = new Map<number, { w: number; l: number; d: number }>();
  const rec = (id: number | null) => {
    if (id == null || id === 0) return null;
    let o = h2hRec.get(id);
    if (!o) {
      o = { w: 0, l: 0, d: 0 };
      h2hRec.set(id, o);
    }
    return o;
  };
  for (const m of h2h) {
    if (m.winner === null) {
      const a = rec(m.entry_1);
      const b = rec(m.entry_2);
      if (a) a.d++;
      if (b) b.d++;
    } else {
      const wo = rec(m.winner);
      if (wo) wo.w++;
      const loserId = m.winner === m.entry_1 ? m.entry_2 : m.entry_1;
      const lo = rec(loserId);
      if (lo) lo.l++;
    }
  }

  // cumulative-net standings for rank movement (first vs last finished GW)
  const events = [...new Set(classic.map((r) => r.event))].sort((a, b) => a - b);
  const rankDelta = new Map<number, number>();
  if (events.length >= 2) {
    const firstRanks = cumulativeRanks(classic, events, events[0]);
    const lastRanks = cumulativeRanks(classic, events, events.at(-1)!);
    for (const [id, lastR] of lastRanks) {
      const firstR = firstRanks.get(id);
      if (firstR != null) rankDelta.set(id, firstR - lastR); // + = climbed
    }
  }

  const stats: MStat[] = overview.map((o) => {
    const rows = byMgr.get(o.entry_id) ?? [];
    const nets = rows.map((r) => r.net_points);
    const positions = rows.map((r) => r.position);
    const costs = rows.map((r) => r.gross_points - r.net_points);
    const hitRows = rows.filter((r) => r.gross_points - r.net_points > 0);
    const h = h2hRec.get(o.entry_id) ?? { w: 0, l: 0, d: 0 };
    const first = rows[0];

    return {
      entry_id: o.entry_id,
      played: rows.length,
      sumNet: nets.reduce((a, b) => a + b, 0),
      avgNet: rows.length ? nets.reduce((a, b) => a + b, 0) / rows.length : 0,
      sumTransfers: rows.reduce((a, r) => a + r.transfers, 0),
      sumCost: costs.reduce((a, b) => a + b, 0),
      maxGwGross: rows.length ? Math.max(...rows.map((r) => r.gross_points)) : 0,
      minGwNet: rows.length ? Math.min(...nets) : 0,
      bestHitNet: hitRows.length
        ? Math.max(...hitRows.map((r) => r.net_points))
        : -Infinity,
      maxGwCost: costs.length ? Math.max(...costs) : 0,
      lastPlaceWeeks: rows.filter(
        (r) => r.position === eventMaxPos.get(r.event),
      ).length,
      secondPlaceWeeks: rows.filter((r) => r.position === 2).length,
      streakTop3: longestStreak(rows, (r) => r.position <= 3),
      posStdev: stdev(positions),
      firstEvent: first?.event ?? 0,
      firstGwGross: first?.gross_points ?? 0,
      firstGwRank: first?.position ?? 0,
      banhMi: o.banh_mi,
      totalXp: o.xp,
      totalPoints: o.total_points,
      wins: h.w,
      losses: h.l,
      draws: h.d,
    };
  });

  return { stats, rankDelta };
}

// cumulative-net standing ranks up to `upto` (competition rank, ties share)
function cumulativeRanks(
  classic: ClassicRow[],
  events: number[],
  upto: number,
): Map<number, number> {
  const sum = new Map<number, number>();
  for (const r of classic) {
    if (r.event <= upto) sum.set(r.entry_id, (sum.get(r.entry_id) ?? 0) + r.net_points);
  }
  const arr = [...sum.entries()].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<number, number>();
  arr.forEach(([id, net], i) => {
    ranks.set(
      id,
      i > 0 && net === arr[i - 1][1] ? ranks.get(arr[i - 1][0])! : i + 1,
    );
  });
  return ranks;
}

// ─────────────── extrema helper ───────────────
type Ext = { winners: MStat[]; value: number } | null;
function extrema(
  items: MStat[],
  val: (s: MStat) => number,
  dir: "max" | "min",
  eps = 1e-6,
): Ext {
  const pool = items.filter((s) => Number.isFinite(val(s)));
  if (!pool.length) return null;
  let best = val(pool[0]);
  for (const s of pool) {
    const v = val(s);
    if (dir === "max" ? v > best : v < best) best = v;
  }
  return {
    winners: pool.filter((s) => Math.abs(val(s) - best) < eps),
    value: best,
  };
}

// ─────────────── static catalog (always rendered) ───────────────
// Every badge is defined up-front with a fixed accent so the board shows all
// 26 cards immediately; winners/value fill in once results qualify.
type AchDef = {
  key: string;
  emoji: string;
  title: string;
  tone: "praise" | "troll";
  accent: string;
  unit: string;
};

export const ACHIEVEMENT_DEFS: AchDef[] = [
  // ---- PRAISE ----
  { key: "banh-mi", emoji: "🥖", title: "Vua Bánh Mì", tone: "praise", accent: TEAL, unit: "tuần nhất" },
  { key: "trum", emoji: "👑", title: "Ông Trùm", tone: "praise", accent: EMERALD, unit: "tổng điểm" },
  { key: "thanh-thien", emoji: "😇", title: "Thánh Thiện", tone: "praise", accent: CYAN, unit: "XP thấp nhất" },
  { key: "cam-quan", emoji: "🎯", title: "Nhà Cầm Quân", tone: "praise", accent: TEAL, unit: "điểm GW cao nhất" },
  { key: "phong-do", emoji: "🔥", title: "Phong Độ Hủy Diệt", tone: "praise", accent: EMERALD, unit: "tuần top-3 liên tiếp" },
  { key: "tri-tue", emoji: "🧠", title: "Trí Tuệ Nhân Tạo", tone: "praise", accent: CYAN, unit: "net trung bình" },
  { key: "doi-khang", emoji: "🥊", title: "Vua Đối Kháng", tone: "praise", accent: TEAL, unit: "trận thắng H2H" },
  { key: "buc-tuong", emoji: "🛡️", title: "Bức Tường", tone: "praise", accent: EMERALD, unit: "thua H2H ít nhất" },
  { key: "phu-thuy", emoji: "✂️", title: "Phù Thủy Chuyển Nhượng", tone: "praise", accent: CYAN, unit: "net cao nhất tuần ăn hit" },
  { key: "kien-dinh", emoji: "💎", title: "Kiên Định", tone: "praise", accent: TEAL, unit: "transfer cả mùa" },
  { key: "ngua-o", emoji: "📈", title: "Ngựa Ô", tone: "praise", accent: EMERALD, unit: "bậc thăng hạng" },
  { key: "khoi-dau", emoji: "⚡", title: "Khởi Đầu Nạt Nộ", tone: "praise", accent: CYAN, unit: "điểm vòng mở màn" },
  // ---- TROLL ----
  { key: "vua-xp", emoji: "🤡", title: "Vua XP", tone: "troll", accent: ROSE, unit: "XP bị phạt" },
  { key: "doi-so", emoji: "🪫", title: "Đội Sổ", tone: "troll", accent: AMBER, unit: "tuần đứng bét" },
  { key: "dot-tien", emoji: "💸", title: "Đốt Tiền Vô Ích", tone: "troll", accent: VIOLET, unit: "tổng hit" },
  { key: "con-bac", emoji: "🎰", title: "Con Bạc Khát Nước", tone: "troll", accent: ROSE, unit: "lượt transfer" },
  { key: "ho-den", emoji: "🕳️", title: "Hố Đen", tone: "troll", accent: AMBER, unit: "net GW thấp nhất" },
  { key: "rua-bo", emoji: "🐌", title: "Rùa Bò", tone: "troll", accent: VIOLET, unit: "net trung bình" },
  { key: "keo-duoi", emoji: "🥶", title: "Vua Kèo Dưới", tone: "troll", accent: ROSE, unit: "thua H2H" },
  { key: "hoa-ca-lang", emoji: "🤝", title: "Ông Hòa Cả Làng", tone: "troll", accent: AMBER, unit: "trận hòa" },
  { key: "tut-doc", emoji: "📉", title: "Tụt Dốc Không Phanh", tone: "troll", accent: VIOLET, unit: "bậc rớt hạng" },
  { key: "chem-gio", emoji: "🎭", title: "Thánh Chém Gió", tone: "troll", accent: ROSE, unit: "hit 1 tuần lớn nhất" },
  { key: "doi-banh-mi", emoji: "🍞", title: "Đói Bánh Mì", tone: "troll", accent: AMBER, unit: "lần đứng nhất" },
  { key: "ngu-quen", emoji: "😴", title: "Ngủ Quên", tone: "troll", accent: VIOLET, unit: "transfer · hạng bét" },
  { key: "tau-luon", emoji: "🎢", title: "Tàu Lượn", tone: "troll", accent: ROSE, unit: "độ dao động hạng" },
  { key: "ve-nhi", emoji: "🧊", title: "Vua Về Nhì", tone: "troll", accent: AMBER, unit: "tuần hạng 2" },
];

// ─────────────── resolve winners+value per badge (only when data qualifies) ──
type Result = { winners: AchWinner[]; value: string };

function resolveResults(
  overview: OverviewRow[],
  classic: ClassicRow[],
  h2h: H2HMatchRow[],
): Map<string, Result> {
  const res = new Map<string, Result>();
  if (!overview.length || !classic.length) return res;

  const { stats, rankDelta } = buildStats(overview, classic, h2h);
  const nameOf = new Map(overview.map((o) => [o.entry_id, o]));
  const winnersOf = (ss: MStat[]): AchWinner[] =>
    ss
      .map((s) => nameOf.get(s.entry_id)!)
      .filter(Boolean)
      .map((o) => ({
        entry_id: o.entry_id,
        player_name: o.player_name,
        entry_name: o.entry_name,
      }));

  const playedH2H = stats.filter((s) => s.wins + s.losses + s.draws > 0);
  const bottomHalf = [...stats]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(Math.ceil(stats.length / 2));
  const hasBanhMi = stats.some((s) => s.banhMi > 0);

  const int = (n: number) => String(Math.round(n));
  const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const grouped = (n: number) => n.toLocaleString("vi-VN");

  const put = (
    key: string,
    ext: Ext,
    fmt: (v: number) => string,
    guard?: (v: number) => boolean,
  ) => {
    if (!ext || !ext.winners.length) return;
    if (guard && !guard(ext.value)) return;
    res.set(key, { winners: winnersOf(ext.winners), value: fmt(ext.value) });
  };

  // ---- PRAISE ----
  put("banh-mi", extrema(stats, (s) => s.banhMi, "max"), int, (v) => v > 0);
  put("trum", extrema(stats, (s) => s.totalPoints, "max"), grouped);
  put("thanh-thien", extrema(stats, (s) => s.totalXp, "min"), one);
  put("cam-quan", extrema(stats, (s) => s.maxGwGross, "max"), int);
  put("phong-do", extrema(stats, (s) => s.streakTop3, "max"), int, (v) => v >= 2);
  put("tri-tue", extrema(stats, (s) => s.avgNet, "max"), one);
  put("doi-khang", extrema(playedH2H, (s) => s.wins, "max"), int, (v) => v > 0);
  put("buc-tuong", extrema(playedH2H, (s) => s.losses, "min"), int);
  put("phu-thuy", extrema(stats, (s) => s.bestHitNet, "max"), int);
  put("kien-dinh", extrema(stats, (s) => s.sumTransfers, "min"), int);
  put("ngua-o", extremaMap(stats, rankDelta, "max"), signed, (v) => v > 0);
  put("khoi-dau",
    extrema(stats.filter((s) => s.firstGwRank === 1), (s) => s.firstGwGross, "max"),
    int);

  // ---- TROLL ----
  put("vua-xp", extrema(stats, (s) => s.totalXp, "max"), one, (v) => v > 0);
  put("doi-so", extrema(stats, (s) => s.lastPlaceWeeks, "max"), int, (v) => v > 0);
  put("dot-tien", extrema(stats, (s) => s.sumCost, "max"), (v) => `-${int(v)}`, (v) => v > 0);
  put("con-bac", extrema(stats, (s) => s.sumTransfers, "max"), int, (v) => v > 0);
  put("ho-den", extrema(stats, (s) => s.minGwNet, "min"), int);
  put("rua-bo", extrema(stats, (s) => s.avgNet, "min"), one);
  put("keo-duoi", extrema(playedH2H, (s) => s.losses, "max"), int, (v) => v > 0);
  put("hoa-ca-lang", extrema(playedH2H, (s) => s.draws, "max"), int, (v) => v > 0);
  put("tut-doc", extremaMap(stats, rankDelta, "min"), signed, (v) => v < 0);
  put("chem-gio", extrema(stats, (s) => s.maxGwCost, "max"), (v) => `-${int(v)}`, (v) => v > 0);
  put("doi-banh-mi",
    hasBanhMi ? extrema(stats, (s) => s.banhMi, "min") : null,
    int, (v) => v === 0);
  put("ngu-quen", extrema(bottomHalf, (s) => s.sumTransfers, "min"), int);
  put("tau-luon", extrema(stats, (s) => s.posStdev, "max"), (v) => `±${v.toFixed(1)}`, (v) => v > 0);
  put("ve-nhi", extrema(stats, (s) => s.secondPlaceWeeks, "max"), int, (v) => v > 0);

  return res;
}

// ─────────────── main ───────────────
// Always returns the full catalog; unresolved badges carry empty winners +
// a "—" value so the frontend can render them as "chờ kết quả" placeholders.
export function computeAchievements(
  overview: OverviewRow[],
  classic: ClassicRow[],
  h2h: H2HMatchRow[],
): Achievement[] {
  const res = resolveResults(overview, classic, h2h);
  return ACHIEVEMENT_DEFS.map((d) => {
    const r = res.get(d.key);
    return { ...d, winners: r?.winners ?? [], value: r?.value ?? "—" };
  });
}

// extrema over an external value map (rank movement)
function extremaMap(
  items: MStat[],
  map: Map<number, number>,
  dir: "max" | "min",
): Ext {
  const withVal = items.filter((s) => map.has(s.entry_id));
  if (!withVal.length) return null;
  return extrema(withVal, (s) => map.get(s.entry_id)!, dir);
}
