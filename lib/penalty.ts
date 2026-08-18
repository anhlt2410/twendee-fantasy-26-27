// Domain logic — XP (LOCKED, exact). See CLAUDE.md §5. Do not rewrite.
export type Standing = { entryId: number; net: number };

// CLASSIC XP for one GW
export function classicXp(standings: Standing[], step = 10): Map<number, number> {
  const N = standings.length;
  const numPenalized = Math.ceil(N / 2); // odd N → median penalized
  const start = N - numPenalized + 1;
  const sorted = [...standings].sort((a, b) => b.net - a.net);
  const slotP = (slot: number) => (slot < start ? 0 : (slot - start + 1) * step);

  const xp = new Map<number, number>();
  for (let i = 0; i < N; ) {
    let j = i;
    while (j < N && sorted[j].net === sorted[i].net) j++; // equal-net group [i,j)
    let pool = 0;
    for (let s = i + 1; s <= j; s++) pool += slotP(s); // slot is 1-indexed
    const share = pool / (j - i);
    for (let k = i; k < j; k++) xp.set(sorted[k].entryId, share);
    i = j;
  }
  return xp;
}

// H2H XP for one GW. matches: real-manager side(s) only; AVERAGE = null entry.
export function h2hXp(
  matches: { entry1: number | null; entry2: number | null; winner: number | null }[],
  loss = 10,
  draw = 5,
): Map<number, number> {
  const xp = new Map<number, number>();
  const add = (id: number | null, v: number) => {
    if (id != null) xp.set(id, (xp.get(id) ?? 0) + v);
  };
  for (const m of matches) {
    if (m.winner === null) {
      add(m.entry1, draw);
      add(m.entry2, draw);
    } else add(m.winner === m.entry1 ? m.entry2 : m.entry1, loss);
  }
  return xp;
}

// Standard competition rank (ties share rank) — for classic_rank + bánh mì
export function ranks(standings: Standing[]): Map<number, number> {
  const sorted = [...standings].sort((a, b) => b.net - a.net);
  const r = new Map<number, number>();
  sorted.forEach((s, i) => {
    r.set(
      s.entryId,
      i > 0 && s.net === sorted[i - 1].net ? r.get(sorted[i - 1].entryId)! : i + 1,
    );
  });
  return r;
}
