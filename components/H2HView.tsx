"use client";

import { useState } from "react";
import type { H2HMatchRow, ManagerName } from "@/lib/types";
import GwFilter from "./GwFilter";
import H2HList from "./H2HList";

export default function H2HView({
  matches,
  names,
  finishedGws,
}: {
  matches: H2HMatchRow[];
  names: ManagerName[];
  finishedGws: number[];
}) {
  const lastGw = finishedGws.at(-1) ?? 1;
  const [gw, setGw] = useState<number>(lastGw);

  return (
    <>
      <GwFilter gw={gw} setGw={setGw} />
      <div className="px-3 pt-3">
        <H2HList
          matches={matches.filter((m) => m.event === gw)}
          names={names}
          played={finishedGws.includes(gw)}
        />
      </div>
    </>
  );
}
