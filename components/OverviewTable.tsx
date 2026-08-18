import type { OverviewRow } from "@/lib/types";

// Overview — 6 cols, fits mobile. Vị trí | Tên | tên FPL | điểm | XP | 🥖
export default function OverviewTable({ rows }: { rows: OverviewRow[] }) {
  if (!rows.length) {
    return <Empty>Chưa có dữ liệu.</Empty>;
  }
  const max = rows.length;
  return (
    <div className="rounded-2xl border border-sea-border bg-sea-surface/40">
      <table className="w-full border-collapse text-sm [&>tbody>tr:last-child>td:first-child]:rounded-bl-2xl [&>tbody>tr:last-child>td:last-child]:rounded-br-2xl">
        <thead className="sticky top-0 z-10 bg-sea-surface text-sea-muted shadow-sm sm:top-[66px] [&>tr>th:first-child]:rounded-tl-2xl [&>tr>th:last-child]:rounded-tr-2xl">
          <tr className="text-left">
            <Th className="w-9 text-center">#</Th>
            <Th>Tên</Th>
            <Th className="hidden xs:table-cell">tên FPL</Th>
            <Th className="text-right">Điểm</Th>
            <Th className="text-right">XP</Th>
            <Th className="text-center">🥖</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.entry_id}
              className="border-t border-sea-border/40 transition-colors hover:bg-sea-surface/50"
            >
              <td className="px-2 py-3 text-center">
                <Rank pos={r.position} max={max} />
              </td>
              <td className="px-2 py-3 font-semibold text-sea-text">
                {r.player_name}
                <span className="block truncate text-[11px] font-normal text-sea-muted/70 xs:hidden">
                  {r.entry_name}
                </span>
              </td>
              <td className="hidden px-2 py-3 text-sea-muted xs:table-cell">
                {r.entry_name}
              </td>
              <td className="px-2 py-3 text-right font-bold tabular-nums text-sea-text">
                {r.total_points}
              </td>
              <td className="px-2 py-3 text-right font-bold tabular-nums text-sea-amber">
                {fmt(r.xp)}
              </td>
              <td className="px-2 py-3 text-center font-semibold tabular-nums text-sea-emerald">
                {r.banh_mi || ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ pos, max }: { pos: number; max: number }) {
  const cls =
    pos === 1
      ? "bg-sea-teal text-sea-bg shadow-glow"
      : pos === max
        ? "bg-sea-amber text-sea-bg"
        : "bg-sea-surface2 text-sea-muted ring-1 ring-sea-border";
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums ${cls}`}
    >
      {pos}
    </span>
  );
}

export function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-2 py-2 text-xs font-semibold uppercase ${className}`}>
      {children}
    </th>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-sea-border px-4 py-10 text-center text-sm text-sea-muted">
      {children}
    </div>
  );
}

export function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
