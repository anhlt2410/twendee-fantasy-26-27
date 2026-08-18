"use client";

import { useState } from "react";
import { LayoutGrid, Trophy, Swords, ScrollText, type LucideIcon } from "lucide-react";
import type { ManagerName } from "@/app/page";
import type { ClassicRow, H2HMatchRow, OverviewRow } from "@/lib/types";
import type { Achievement } from "@/lib/achievements";
import OverviewTable from "./OverviewTable";
import ClassicTable from "./ClassicTable";
import H2HList from "./H2HList";
import Achievements from "./Achievements";

type TabKey = "overview" | "classic" | "h2h" | "achievements";

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: "overview", label: "Tổng quan", Icon: LayoutGrid },
  { key: "classic", label: "Classic", Icon: Trophy },
  { key: "h2h", label: "H2H", Icon: Swords },
  { key: "achievements", label: "Sổ đầu bài", Icon: ScrollText },
];

export default function Tabs({
  overview,
  classic,
  h2h,
  names,
  finishedGws,
  achievements,
}: {
  overview: OverviewRow[];
  classic: ClassicRow[];
  h2h: H2HMatchRow[];
  names: ManagerName[];
  finishedGws: number[];
  achievements: Achievement[];
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const lastGw = finishedGws.at(-1) ?? 1;
  const [gw, setGw] = useState<number>(lastGw);

  return (
    <div>
      {/* flush bottom menu bar on mobile, sticky floating pill on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl sm:sticky sm:bottom-auto sm:top-2 sm:px-3 sm:pb-2">
        <div
          role="tablist"
          aria-label="Chuyển tab"
          className="flex gap-1 border-t border-[#1e2c4a] bg-[#0e1a32] p-[5px] pb-[max(5px,env(safe-area-inset-bottom))] shadow-lg sm:rounded-2xl sm:border sm:pb-[5px]"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-[13px] font-medium transition-all duration-200 sm:gap-2 sm:text-sm ${
                  active
                    ? "bg-gradient-to-br from-[#2ee6a6] to-[#12c6e6] text-[#052a23] shadow-[0_4px_16px_rgba(46,230,166,0.3)]"
                    : "text-[#8b97ad] hover:text-slate-200"
                }`}
              >
                <t.Icon size={16} strokeWidth={2.25} className="shrink-0" aria-hidden />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(tab === "classic" || tab === "h2h") && (
        <GwFilter gw={gw} setGw={setGw} />
      )}

      <div className="px-3 pt-3">
        {tab === "overview" && <OverviewTable rows={overview} />}
        {tab === "classic" && (
          <ClassicTable
            rows={classic.filter((r) => r.event === gw)}
            played={finishedGws.includes(gw)}
          />
        )}
        {tab === "h2h" && (
          <H2HList
            matches={h2h.filter((m) => m.event === gw)}
            names={names}
            played={finishedGws.includes(gw)}
          />
        )}
        {tab === "achievements" && <Achievements items={achievements} />}
      </div>
    </div>
  );
}

function GwFilter({
  gw,
  setGw,
}: {
  gw: number;
  setGw: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      <label className="text-xs font-medium text-sea-muted">Vòng đấu</label>
      <select
        value={gw}
        onChange={(e) => setGw(Number(e.target.value))}
        className="rounded-lg border border-sea-border bg-sea-surface px-2.5 py-1.5 text-sm font-semibold text-sea-text focus:border-sea-teal focus:outline-none focus:ring-1 focus:ring-sea-teal"
      >
        {Array.from({ length: 38 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            GW {n}
          </option>
        ))}
      </select>
    </div>
  );
}
