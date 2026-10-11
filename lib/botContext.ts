// Builds a compact Vietnamese "digest" of the whole league — overview, per-GW
// Classic + H2H, and resolved achievements — to stuff into the bot's system
// prompt. The league is tiny (a private group), so context-stuffing beats
// function-calling: one DeepSeek call, low latency, no tool round-trips.
//
// Reuses the already-cached read layer (lib/data.ts) + the Sổ đầu bài engine
// (lib/achievements.ts). Wrapped in unstable_cache(tag: FPL_TAG) so the digest
// is rebuilt only after a sync busts the tag — not on every Telegram message.

import { unstable_cache } from "next/cache";
import { FPL_TAG, getClassic, getH2H, getNames, getOverview } from "./data";
import { computeAchievements } from "./achievements";
import type { ClassicRow, H2HMatchRow } from "./types";

function nameMap(names: { entry_id: number; player_name: string; entry_name: string }[]) {
  const m = new Map<number, string>();
  for (const n of names) m.set(n.entry_id, `${n.player_name} (${n.entry_name})`);
  return m;
}

function overviewBlock(overview: Awaited<ReturnType<typeof getOverview>>): string {
  const lines = overview.map(
    (o) =>
      `#${o.position} ${o.player_name} [${o.entry_name}] — ${o.total_points} điểm · XP ${o.xp} · 🥖 ${o.banh_mi}`,
  );
  return `## BẢNG XẾP HẠNG TỔNG (theo tổng điểm)\n${lines.join("\n")}`;
}

function classicBlock(classic: ClassicRow[]): string {
  const byGw = new Map<number, ClassicRow[]>();
  for (const r of classic) (byGw.get(r.event) ?? byGw.set(r.event, []).get(r.event)!).push(r);
  const gws = [...byGw.keys()].sort((a, b) => a - b);
  const out: string[] = [];
  for (const gw of gws) {
    const rows = byGw.get(gw)!.sort((a, b) => a.position - b.position);
    const lines = rows.map(
      (r) =>
        `  #${r.position} ${r.player_name}: ${r.gross_points}đ gross, ${r.transfers} transfer, ${r.net_points} net, XP ${r.xp} (classic ${r.classic_xp} / h2h ${r.h2h_xp})`,
    );
    out.push(`GW${gw}:\n${lines.join("\n")}`);
  }
  return `## CLASSIC TỪNG GAMEWEEK (xếp theo net của GW)\n${out.join("\n")}`;
}

function h2hBlock(h2h: H2HMatchRow[], names: Map<number, string>): string {
  const byGw = new Map<number, H2HMatchRow[]>();
  for (const m of h2h) (byGw.get(m.event) ?? byGw.set(m.event, []).get(m.event)!).push(m);
  const gws = [...byGw.keys()].sort((a, b) => a - b);
  const nm = (id: number | null) => (id == null ? "AVERAGE" : names.get(id) ?? `#${id}`);
  const out: string[] = [];
  for (const gw of gws) {
    const lines = byGw.get(gw)!.map((m) => {
      const res =
        m.winner === null
          ? "HÒA"
          : `thắng: ${nm(m.winner)}`;
      return `  ${nm(m.entry_1)} ${m.entry_1_points} - ${m.entry_2_points} ${nm(m.entry_2)} → ${res}`;
    });
    out.push(`GW${gw}:\n${lines.join("\n")}`);
  }
  return `## ĐỐI ĐẦU H2H TỪNG GAMEWEEK (thua=10XP, hòa=5XP mỗi bên, AVERAGE không bị phạt)\n${out.join("\n")}`;
}

function achievementsBlock(
  overview: Awaited<ReturnType<typeof getOverview>>,
  classic: ClassicRow[],
  h2h: H2HMatchRow[],
): string {
  const items = computeAchievements(overview, classic, h2h);
  const lines = items
    .filter((a) => a.winners.length > 0)
    .map((a) => {
      const who = a.winners.map((w) => w.player_name).join(", ");
      const tone = a.tone === "praise" ? "khen" : "troll";
      return `${a.emoji} ${a.title} (${tone}): ${who} — ${a.value} ${a.unit}`;
    });
  return `## SỔ ĐẦU BÀI — DANH HIỆU (bánh mì ruốc = số tuần đứng nhất, đội sổ = số tuần bét bảng)\n${lines.join("\n")}`;
}

async function build(): Promise<string> {
  const [overview, classic, h2h, names] = await Promise.all([
    getOverview(),
    getClassic(),
    getH2H(),
    getNames(),
  ]);

  if (!overview.length) {
    return "## DỮ LIỆU\nChưa có dữ liệu league (chưa sync hoặc mùa chưa bắt đầu).";
  }

  const nm = nameMap(names);
  return [
    overviewBlock(overview),
    classicBlock(classic),
    h2hBlock(h2h, nm),
    achievementsBlock(overview, classic, h2h),
  ].join("\n\n");
}

// Rebuilt only when FPL_TAG is busted (after a sync); else served from cache.
export const getLeagueDigest = unstable_cache(build, ["bot-digest"], {
  tags: [FPL_TAG],
  revalidate: 300,
});
