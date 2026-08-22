import type { H2HMatchRow, ManagerName } from "@/lib/types";
import { Empty } from "./OverviewTable";

// H2H — horizontal fixture card: home (right-aligned) · score pill · away
// (left-aligned). Winner side accented in sea-teal with a WIN tag; loser gets a
// LOSE tag in sea-rose; draw stays neutral.
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
        // Not-yet-played GW → show as an upcoming fixture: no score, no winner
        // highlight. Only finished/live GWs (played) carry a result.
        const draw = played && m.winner === null;
        const win1 = played && m.winner === m.entry_1;
        const win2 = played && m.winner === m.entry_2;
        // per-side result drives the WIN/LOSE tag beside each name
        const res1: Result = !played ? null : draw ? "draw" : win1 ? "win" : "lose";
        const res2: Result = !played ? null : draw ? "draw" : win2 ? "win" : "lose";
        return (
          <div
            key={`${m.entry_1}-${m.entry_2}-${i}`}
            className="flex items-stretch gap-2 rounded-2xl border border-sea-border bg-sea-surface/40 p-2 sm:gap-3 sm:p-2.5"
          >
            {/* home — right aligned */}
            <Team info={infoOf(m.entry_1)} align="right" result={res1} />

            {/* score pill (played) / vs pill (upcoming) */}
            {played ? (
              <div className="flex shrink-0 items-center gap-1.5 self-center rounded-full bg-sea-surface2 px-3 py-1.5 ring-1 ring-sea-border sm:gap-2 sm:px-4">
                <Score value={m.entry_1_points} win={win1} draw={draw} />
                <span className="text-sea-muted/60">–</span>
                <Score value={m.entry_2_points} win={win2} draw={draw} />
              </div>
            ) : (
              <div className="flex shrink-0 items-center self-center rounded-full bg-sea-surface2 px-3 py-1.5 ring-1 ring-sea-border sm:px-4">
                <span className="text-xs font-bold uppercase tracking-wide text-sea-muted">
                  vs
                </span>
              </div>
            )}

            {/* away — left aligned */}
            <Team info={infoOf(m.entry_2)} align="left" result={res2} />
          </div>
        );
      })}
    </div>
  );
}

type Result = "win" | "lose" | "draw" | null;

function Team({
  info,
  align,
  result,
}: {
  info: Info;
  align: "left" | "right";
  result: Result;
}) {
  const win = result === "win";
  // tag sits on the inner side (toward the score pill)
  const tag = (result === "win" || result === "lose") && <Tag result={result} />;
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col justify-center ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {align === "left" && tag}
        <span
          className={`truncate text-sm font-bold ${
            win ? "text-sea-teal" : "text-sea-text"
          }`}
        >
          {info.player}
        </span>
        {align === "right" && tag}
      </div>
      {info.team && (
        <span className="max-w-full truncate text-xs text-sea-muted">
          {info.team}
        </span>
      )}
    </div>
  );
}

function Tag({ result }: { result: "win" | "lose" }) {
  const win = result === "win";
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        win
          ? "bg-sea-teal/10 text-sea-teal ring-sea-teal/30"
          : "bg-sea-rose/10 text-sea-rose ring-sea-rose/30"
      }`}
    >
      {win ? "Win" : "Lose"}
    </span>
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
