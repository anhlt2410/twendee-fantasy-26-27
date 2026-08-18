import type { ClassicRow } from "@/lib/types";
import { Empty, fmt } from "./OverviewTable";

// Classic — 9 cols. Sticky left 2 (Vị trí + Tên); numeric block scrolls X.
// Vị trí | Tên | tên FPL | điểm vòng đấu | transfer | điểm chuẩn | XP | Classic | H2H
const NUM_COLS: { key: keyof ClassicRow; label: string; title: string }[] = [
  { key: "entry_name", label: "FPL", title: "tên FPL" },
  { key: "gross_points", label: "Điểm", title: "điểm vòng đấu" },
  { key: "transfers", label: "TF", title: "số lần transfer" },
  { key: "net_points", label: "Chuẩn", title: "điểm chuẩn (đã trừ hit)" },
  { key: "xp", label: "XP", title: "tổng XP phạt" },
  { key: "classic_xp", label: "CL", title: "Classic XP" },
  { key: "h2h_xp", label: "H2H", title: "H2H XP" },
];

export default function ClassicTable({
  rows,
  played,
}: {
  rows: ClassicRow[];
  played: boolean;
}) {
  if (!played) return <Empty>Vòng đấu chưa diễn ra</Empty>;
  if (!rows.length) return <Empty>Chưa có dữ liệu vòng này.</Empty>;

  const sorted = [...rows].sort((a, b) => a.position - b.position);

  return (
    <div className="scroll-x overflow-x-auto rounded-2xl border border-sea-border bg-sea-surface/40">
      <table className="border-collapse text-sm">
        <thead className="bg-sea-surface text-sea-muted">
          <tr>
            <th className="sticky left-0 z-20 bg-sea-surface px-2 py-2.5 text-center text-xs font-semibold uppercase">
              #
            </th>
            <th className="sticky left-9 z-20 bg-sea-surface px-2 py-2.5 text-left text-xs font-semibold uppercase">
              Tên
            </th>
            {NUM_COLS.map((c) => (
              <th
                key={c.key}
                title={c.title}
                className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.entry_id} className="border-t border-sea-border/40">
              <td className="sticky left-0 z-10 bg-sea-bg2 px-2 py-2.5 text-center font-bold tabular-nums text-sea-muted">
                {r.position}
              </td>
              <td className="sticky left-9 z-10 whitespace-nowrap bg-sea-bg2 px-2 py-2.5 font-semibold text-sea-text">
                {r.player_name}
              </td>
              {NUM_COLS.map((c) => (
                <td
                  key={c.key}
                  className={cellClass(c.key)}
                >
                  {render(r, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cellClass(key: keyof ClassicRow) {
  const base = "whitespace-nowrap px-3 py-2.5 text-right tabular-nums";
  if (key === "entry_name") return `${base} text-sea-muted`;
  if (key === "xp") return `${base} font-bold text-sea-amber`;
  if (key === "net_points") return `${base} font-semibold text-sea-text`;
  return `${base} text-sea-text/80`;
}

function render(r: ClassicRow, key: keyof ClassicRow) {
  const v = r[key];
  if (key === "entry_name") return String(v);
  if (key === "xp" || key === "classic_xp" || key === "h2h_xp") {
    return fmt(Number(v));
  }
  return String(v);
}
