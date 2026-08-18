"use client";

import { useState } from "react";
import type { ClassicRow } from "@/lib/types";
import GwFilter from "./GwFilter";
import ClassicTable from "./ClassicTable";

export default function ClassicView({
  rows,
  finishedGws,
}: {
  rows: ClassicRow[];
  finishedGws: number[];
}) {
  const lastGw = finishedGws.at(-1) ?? 1;
  const [gw, setGw] = useState<number>(lastGw);

  return (
    <>
      <GwFilter gw={gw} setGw={setGw} />
      <div className="px-3 pt-3">
        <ClassicTable
          rows={rows.filter((r) => r.event === gw)}
          played={finishedGws.includes(gw)}
        />
      </div>
    </>
  );
}
