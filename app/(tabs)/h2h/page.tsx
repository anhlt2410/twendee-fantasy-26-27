import { getFinishedGws, getH2H, getNames } from "@/lib/data";
import H2HView from "@/components/H2HView";

export const revalidate = 300;

export default async function H2HPage() {
  const [h2h, names, finishedGws] = await Promise.all([
    getH2H(),
    getNames(),
    getFinishedGws(),
  ]);
  return <H2HView matches={h2h} names={names} finishedGws={finishedGws} />;
}
