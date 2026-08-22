import { getOverview } from "@/lib/data";
import OverviewTable from "@/components/OverviewTable";

export const revalidate = 120;

export default async function OverviewPage() {
  const overview = await getOverview();
  return (
    <div className="px-3 pt-3">
      <OverviewTable rows={overview} />
    </div>
  );
}
