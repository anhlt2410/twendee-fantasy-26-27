import type { Achievement } from "@/lib/achievements";
import { Empty } from "./OverviewTable";

// Sổ đầu bài — season achievement cards. Praise + troll sections, 2-col grid.
// Accent color per card drives chips/rail/badge via the --accent CSS var.
const MAX_CHIPS = 3;

export default function Achievements({ items }: { items: Achievement[] }) {
  if (!items.length) {
    return <Empty>Chưa có danh hiệu — mùa giải chưa bắt đầu.</Empty>;
  }
  const praise = items.filter((a) => a.tone === "praise");
  const troll = items.filter((a) => a.tone === "troll");

  return (
    <div className="space-y-6">
      <Section label="Vinh danh" tone="praise" items={praise} />
      <Section label="Cà khịa" tone="troll" items={troll} />
    </div>
  );
}

function Section({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "praise" | "troll";
  items: Achievement[];
}) {
  if (!items.length) return null;
  const dot = tone === "praise" ? "bg-sea-emerald" : "bg-[#fb7185]";
  const text = tone === "praise" ? "text-sea-emerald" : "text-[#fb7185]";
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h2 className={`text-xs font-extrabold uppercase tracking-[0.12em] ${text}`}>
          {label}
        </h2>
        <span className="h-px flex-1 bg-sea-border" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((a) => (
          <Card key={a.key} a={a} />
        ))}
      </div>
    </section>
  );
}

function Card({ a }: { a: Achievement }) {
  const pending = a.winners.length === 0;
  const shown = a.winners.slice(0, MAX_CHIPS);
  const extra = a.winners.length - shown.length;
  const tie = a.winners.length > 1;
  const badge =
    a.winners.length === 2 ? "Đồng giải" : `${a.winners.length} người`;

  return (
    <div
      className={`ach-card relative overflow-hidden rounded-2xl border border-sea-border bg-sea-surface px-3 py-3.5 ${
        pending ? "ach-pending" : ""
      }`}
      style={{ ["--accent" as string]: a.accent }}
    >
      {tie && <span className="ach-badge">{badge}</span>}
      <span
        className={`mb-2 block text-2xl leading-none drop-shadow ${
          pending ? "opacity-40 grayscale" : ""
        }`}
      >
        {a.emoji}
      </span>
      <div className="text-[13px] font-extrabold leading-tight text-sea-text">
        {a.title}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {pending ? (
          <span className="ach-wait">Chờ kết quả</span>
        ) : (
          <>
            {shown.map((w) => (
              <span key={w.entry_id} className="ach-chip" title={w.entry_name}>
                {w.player_name}
              </span>
            ))}
            {extra > 0 && (
              <span className="text-[11px] font-bold text-sea-muted">+{extra}</span>
            )}
          </>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 border-t border-dashed border-sea-border pt-2">
        <b
          className={`text-base font-extrabold tabular-nums ${
            pending ? "text-sea-muted/50" : "text-sea-text"
          }`}
        >
          {a.value}
        </b>
        <span className="text-[10.5px] uppercase tracking-wide text-sea-muted">
          {a.unit}
        </span>
      </div>
    </div>
  );
}
