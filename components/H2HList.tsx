import type { H2HMatchRow, ManagerName } from "@/lib/types";
import { Empty } from "./OverviewTable";

// H2H — horizontal fixture card: GW badge · home (right-aligned) · score pill ·
// away (left-aligned). Winner side accented in sea-teal; draw stays neutral.
type Info = { player: string; team: string };

export default function H2HList({
  matches,
  names,
  played,
}: {
  matches: H2HMatchRow[];
  names: ManagerName[];
  played: boolean;
}) {
  if (!played) return <Empty>Vòng đấu chưa diễn ra</Empty>;
  if (!matches.length) return <Empty>Chưa có lịch đấu vòng này.</Empty>;

  const byId = new Map(names.map((n) => [n.entry_id, n]));
  const infoOf = (id: number | null): Info => {
    if (id == null || id === 0) return { player: "AVERAGE", team: "" };
    const n = byId.get(id);
    return n
      ? { player: n.player_name, team: n.entry_name }
      : { player: `#${id}`, team: "" };
  };

  return (
    <div className="space-y-2.5">
      {matches.map((m, i) => {
        const draw = m.winner === null;
        const win1 = m.winner === m.entry_1;
        const win2 = m.winner === m.entry_2;
        return (
          <div
            key={`${m.entry_1}-${m.entry_2}-${i}`}
            className="flex items-stretch gap-2 rounded-2xl border border-sea-border bg-sea-surface/40 p-2 sm:gap-3 sm:p-2.5"
          >
            {/* GW badge */}
            <div className="grid shrink-0 place-items-center rounded-xl bg-sea-teal/10 px-2.5 text-[11px] font-bold uppercase tracking-wide text-sea-teal ring-1 ring-sea-teal/20 sm:px-3.5 sm:text-xs">
              GW{m.event}
            </div>

            {/* home — right aligned */}
            <Team info={infoOf(m.entry_1)} align="right" win={win1} />

            {/* score pill */}
            <div className="flex shrink-0 items-center gap-1.5 self-center rounded-full bg-sea-surface2 px-3 py-1.5 ring-1 ring-sea-border sm:gap-2 sm:px-4">
              <Score value={m.entry_1_points} win={win1} draw={draw} />
              <span className="text-sea-muted/60">–</span>
              <Score value={m.entry_2_points} win={win2} draw={draw} />
            </div>

            {/* away — left aligned */}
            <Team info={infoOf(m.entry_2)} align="left" win={win2} />
          </div>
        );
      })}
    </div>
  );
}

function Team({
  info,
  align,
  win,
}: {
  info: Info;
  align: "left" | "right";
  win: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col justify-center ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {win && align === "left" && <Dot />}
        <span
          className={`truncate text-sm font-bold ${
            win ? "text-sea-teal" : "text-sea-text"
          }`}
        >
          {info.player}
        </span>
        {win && align === "right" && <Dot />}
      </div>
      {info.team && (
        <span className="max-w-full truncate text-xs text-sea-muted">
          {info.team}
        </span>
      )}
    </div>
  );
}

function Score({
  value,
  win,
  draw,
}: {
  value: number;
  win: boolean;
  draw: boolean;
}) {
  return (
    <span
      className={`min-w-[1.25rem] text-center text-base font-extrabold tabular-nums sm:text-lg ${
        win
          ? "text-sea-teal"
          : draw
            ? "text-sea-text/80"
            : "text-sea-muted"
      }`}
    >
      {value}
    </span>
  );
}

function Dot() {
  return (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sea-teal shadow-glow" />
  );
}
