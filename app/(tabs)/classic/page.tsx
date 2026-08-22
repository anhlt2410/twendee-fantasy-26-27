import { getClassic, getFinishedGws } from "@/lib/data";
import ClassicView from "@/components/ClassicView";

export const revalidate = 120;

export default async function ClassicPage() {
  const [classic, finishedGws] = await Promise.all([
    getClassic(),
    getFinishedGws(),
  ]);
  return <ClassicView rows={classic} finishedGws={finishedGws} />;
}
