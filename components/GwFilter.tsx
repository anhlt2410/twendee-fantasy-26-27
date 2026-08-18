"use client";

export default function GwFilter({
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
