import { getClassic, getFinishedGws, getOverview } from "@/lib/data";
import { fmt } from "@/components/OverviewTable";
import TabNav from "@/components/TabNav";
import type { ClassicRow, OverviewRow } from "@/lib/types";

export const revalidate = 300; // ISR: re-read Supabase every 5 min

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [overviewRows, classicRows, finishedGws] = await Promise.all([
    getOverview(),
    getClassic(),
    getFinishedGws(),
  ]);
  const started = finishedGws.length > 0;

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
      <header className="hero-bg relative overflow-hidden px-4 pb-12 pt-6">
        <HeroLion />
        <div className="relative z-10 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sea-surface shadow-glow ring-1 ring-sea-border">
            <span
              aria-label="Twendee"
              role="img"
              className="block h-6 w-6 bg-[#5b8def]"
              style={{
                maskImage: "url(/twendee-mark.png)",
                WebkitMaskImage: "url(/twendee-mark.png)",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskSize: "contain",
                WebkitMaskSize: "contain",
              }}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight text-sea-text sm:text-xl">
              Cúp Hải Sản Twendee
              <span className="ml-1.5 bg-gradient-to-r from-sea-teal to-sea-emerald bg-clip-text text-transparent">
                2026-2027
              </span>
            </h1>
            <p className="mt-0.5 truncate text-xs text-sea-muted">
              Đường dài mới biết con ngựa nào hài
            </p>
          </div>
        </div>

        {/* hero summary strip — bridges header ↔ data */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2.5">
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
        <TabNav />
        {children}
      </div>
    </main>
  );
}

// Premier League lion crest — decorative watermark, bleeds off the top-right.
function HeroLion() {
  return (
    <svg
      viewBox="0 0 269.04 342.49"
      aria-hidden
      className="pointer-events-none absolute -right-7 -top-6 z-0 h-[168px] w-auto select-none opacity-[0.11] sm:h-[188px]"
      fill="#ffffff"
    >
      <path
        transform="translate(-377.48 -340.75)"
        d="M430.79 369.07a131.3 131.3 0 0 1 26.76 17c-.66-4-3.76-22.78-5.75-34.29 8.63 6 29.42 20.35 36.05 25 2.65-8.41 12.39-36.05 12.39-36.05s17.25 27.67 19.91 32.27c3.76-3.54 24.11-26.54 29.42-32.29 1.11 13.05 2 32.07 2.43 34.73a131.5 131.5 0 0 1 22.12-22.78c-5.75 11.28-8.41 26.76-9.73 39.37a147 147 0 0 0-40.7-5.75A150.8 150.8 0 0 0 448.92 406c-3.76-12.16-9.73-27.2-18.13-36.93m207.48 237.56-11.94-13.27c-3.32 35.61-21 66.14-53.09 87.37l-5.09-19.24c-27.43 19.69-74.1 32.29-114.36 9.73 5.09-25.44 9.29-51.32 0-82.28-22.34 34.29-42 48-42 48-15-25.44-13.71-76.09-9.29-91.13l-25 7.74c0-17 12.39-53.09 30.08-73.44l-15.26-2.43a148.3 148.3 0 0 1 46-54.64c-6 9.73-6 32.29 11.06 40.92-7.3-12.61-8-28.31-.66-36.72 7.74-8.41 20.35-5.31 28.31 1.11-2.43-7.08-9.73-15.93-19.91-16.59 19.91-10.4 43.13-15.93 67-15.93 4.65 0 9.07.44 13.27.66 7.08 2.65 17.25 12.61 22.12 19a35.1 35.1 0 0 0-3.76-15.93c26.1 6.41 38.71 17 43.8 22.12 1.11 11.28 4.42 17.92 9.07 28.76-8.41-9.29-29.64-24.77-40-28.31 0 0-1.11 9.73-4.42 14.38-20.35-14.6-30.08-18.36-30.08-18.36-22.56 2.21-36.5 11.06-44.46 17.7l6.64 5.75c-13.27 4-22.12 15.7-22.12 15.7 0 .44 11.94 2 11.94 2s-1.33 13.94 16.37 22.78c15 7.3 36.28-1.77 56.63 6.41-13.27-15.26-22.34-22.34-22.34-22.34a55.5 55.5 0 0 0-9.07-1.11c-4.65 0-11.72 1.11-19-2-3.76-1.33-8-4-11.06-6 0 0 9.29-9.73 23-11.72 0 0 12.39 3.32 22.12 10.62 6.41-6.41 13.27-6 13.27-6s-6.64 6.41-4.65 13.71a256 256 0 0 1 20.35 21c10.62-6 34.06-4.65 38.93 1.11-6-8-15-14.38-21.68-19.91-.66-3.1-8.41-13.27-9.29-14.38a45.9 45.9 0 0 1 13.27 7.74 16.85 16.85 0 0 1 9.73-6.41c4.65 4 5.75 10 5.31 11.06a12.84 12.84 0 0 1-4.42 3.76l11.28 12.39 1.11-9.07c26.27 37.48 40.65 81.06 22.29 135.69m-49.55-80.74v-19.24a61.8 61.8 0 0 1-17.92-10c-18.58 2.65-40.92 21.46-40.92 21.46s7.74 14.38 15.93 30.08c14.6 1.59 36.27-16.54 42.91-22.3m18.58 34.95a33.26 33.26 0 0 0-8-15.26L585 546s-19.69 16.59-31.41 17l10 18.58c6.64-1.33 17.92-6.64 22.78-11.94a68.4 68.4 0 0 1 2.43 21.68c6.55-4.15 15.62-14.32 18.5-30.48m6-63.7a148 148 0 0 1-13.3 9.73v19.24c5.31 5.75 10.4 10.62 14.38 19.24 7.3-12.82 5.53-32.06-1.11-48.21Z"
      />
    </svg>
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
