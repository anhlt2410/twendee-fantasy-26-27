import { supabase } from "@/lib/supabase";
import Tabs from "@/components/Tabs";
import { fmt } from "@/components/OverviewTable";
import { computeAchievements } from "@/lib/achievements";
import type { ClassicRow, H2HMatchRow, OverviewRow } from "@/lib/types";

export const revalidate = 300; // ISR: re-read Supabase every 5 min

export type ManagerName = {
  entry_id: number;
  player_name: string;
  entry_name: string;
};

export default async function Page() {
  const [overview, classic, h2h, names, meta] = await Promise.all([
    supabase.from("v_overview").select("*").order("position"),
    supabase.from("v_classic").select("*"),
    supabase.from("h2h_matches").select("*"),
    supabase.from("managers").select("entry_id, player_name, entry_name"),
    supabase.from("gw_meta").select("event, finished"),
  ]);

  const finishedGws = (meta.data ?? [])
    .filter((r) => r.finished)
    .map((r) => r.event)
    .sort((a, b) => a - b);

  const overviewRows = (overview.data ?? []) as OverviewRow[];
  const classicRows = (classic.data ?? []) as ClassicRow[];
  const h2hRows = (h2h.data ?? []) as H2HMatchRow[];
  const started = finishedGws.length > 0;

  const achievements = computeAchievements(overviewRows, classicRows, h2hRows);

  // Top GW Point — highest single-GW gross score across all managers/rounds
  const topGw = classicRows.reduce<ClassicRow | null>(
    (best, r) => (!best || r.gross_points > best.gross_points ? r : best),
    null,
  );
  // Top Bánh mì — most 🥖 (most GW-1 finishes)
  const topBanhMi = overviewRows.reduce<OverviewRow | null>(
    (best, r) => (!best || r.banh_mi > best.banh_mi ? r : best),
    null,
  );
  // Gà công nghiệp — highest total XP penalty
  const topXp = overviewRows.reduce<OverviewRow | null>(
    (best, r) => (!best || r.xp > best.xp ? r : best),
    null,
  );
  const dash = "—";

  return (
    <main className="mx-auto max-w-3xl pb-24 sm:pb-10">
      <header className="relative px-4 pb-12 pt-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sea-surface text-2xl shadow-glow ring-1 ring-sea-border">
            🦑
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight text-sea-text sm:text-xl">
              Cúp Hải Sản Twendee
              <span className="ml-1.5 bg-gradient-to-r from-sea-teal to-sea-emerald bg-clip-text text-transparent">
                2026-2027
              </span>
            </h1>
            <p className="mt-0.5 truncate text-xs text-sea-muted">
              Chả được đồng mẹ nào mà năm nào cũng chơi
            </p>
          </div>
        </div>

        {/* hero summary strip — bridges header ↔ data */}
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <StatCard
            label="Top điểm vòng"
            value={started && topGw ? String(topGw.gross_points) : dash}
            name={started && topGw ? topGw.entry_name : "Chưa bắt đầu"}
            accent
          />
          <StatCard
            label="Top bánh mì 🥖"
            value={started && topBanhMi ? String(topBanhMi.banh_mi) : dash}
            name={started && topBanhMi ? topBanhMi.entry_name : "Chưa bắt đầu"}
          />
          <StatCard
            label="Gà công nghiệp 🐔"
            value={started && topXp ? fmt(topXp.xp) : dash}
            name={started && topXp ? topXp.entry_name : "Chưa bắt đầu"}
          />
        </div>
      </header>

      {/* content overlaps header for a physical link (no filter/blur here so
          the mobile bottom-fixed nav stays anchored to the viewport) */}
      <div className="relative -mt-6 rounded-t-3xl border-t border-sea-border bg-sea-bg/80 shadow-[0_-10px_30px_-14px_rgba(0,0,0,0.7)]">
        <div className="mx-auto h-1 w-10 translate-y-2.5 rounded-full bg-sea-border" />
        <Tabs
          overview={overviewRows}
          classic={(classic.data ?? []) as ClassicRow[]}
          h2h={h2hRows}
          names={(names.data ?? []) as ManagerName[]}
          finishedGws={finishedGws}
          achievements={achievements}
        />
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  name,
  accent = false,
}: {
  label: string;
  value: string;
  name: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-sea-border bg-sea-surface/60 px-3 py-2.5">
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-sea-muted">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-extrabold tabular-nums leading-none ${
          accent ? "text-sea-teal" : "text-sea-text"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-[11px] text-sea-muted" title={name}>
        {name}
      </div>
    </div>
  );
}
