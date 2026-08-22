import { getClassic, getH2H, getOverview } from "@/lib/data";
import { computeAchievements } from "@/lib/achievements";
import Achievements from "@/components/Achievements";

export const revalidate = 120;

export default async function AchievementsPage() {
  const [overview, classic, h2h] = await Promise.all([
    getOverview(),
    getClassic(),
    getH2H(),
  ]);
  const achievements = computeAchievements(overview, classic, h2h);
  return (
    <div className="px-3 pt-3">
      <Achievements items={achievements} />
    </div>
  );
}
