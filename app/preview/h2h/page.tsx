// TEMPORARY UI preview — sample H2H data, no Supabase reads/writes.
// Delete this route once FPL publishes the real H2H schedule.
import type { ManagerName } from "@/app/page";
import type { H2HMatchRow } from "@/lib/types";
import H2HList from "@/components/H2HList";

const NAMES: ManagerName[] = [
  { entry_id: 4631434, player_name: "Alpha XYZ", entry_name: "Fergie Time 7" },
  { entry_id: 3480868, player_name: "Nam Nguyễn Tuấn", entry_name: "Hana" },
  { entry_id: 3059895, player_name: "Hung Lam", entry_name: "Hung Lam" },
  { entry_id: 3057821, player_name: "A N", entry_name: "London is Blue" },
  { entry_id: 2220046, player_name: "Phong Trần", entry_name: "Oscar#81Piastri" },
  { entry_id: 2167507, player_name: "Nghĩa Trần", entry_name: "Nghĩa's Team" },
  { entry_id: 2169684, player_name: "Nguyen Truyen", entry_name: "ShivaN_262626" },
  { entry_id: 2169983, player_name: "Việt Nguyễn", entry_name: "102" },
  { entry_id: 2167192, player_name: "Tú Anh Lê", entry_name: "aaron.2410" },
  { entry_id: 2167137, player_name: "CR Anh Đức", entry_name: "MU 4ever" },
  { entry_id: 707581, player_name: "Khoi Bui-Kinh", entry_name: "Šeškon the Beach" },
  { entry_id: 697618, player_name: "Long End", entry_name: "Nhà Vô Địch" },
  { entry_id: 691650, player_name: "Hoc Vu Van", entry_name: "Tonysayhiii" },
  { entry_id: 412969, player_name: "Thang Le", entry_name: "Đứt Thắng (Anti BOU)" },
  { entry_id: 385021, player_name: "Hung CR", entry_name: "crjs_twendee" },
];

// GW1 sample: 7 real pairings (win / draw mix) + 1 vs AVERAGE (entry 0).
const MATCHES: H2HMatchRow[] = [
  { event: 1, entry_1: 4631434, entry_1_points: 72, entry_2: 3480868, entry_2_points: 58, winner: 4631434 },
  { event: 1, entry_1: 3059895, entry_1_points: 61, entry_2: 3057821, entry_2_points: 61, winner: null },
  { event: 1, entry_1: 2220046, entry_1_points: 45, entry_2: 2167507, entry_2_points: 67, winner: 2167507 },
  { event: 1, entry_1: 2169684, entry_1_points: 80, entry_2: 2169983, entry_2_points: 54, winner: 2169684 },
  { event: 1, entry_1: 2167192, entry_1_points: 63, entry_2: 2167137, entry_2_points: 49, winner: 2167192 },
  { event: 1, entry_1: 707581, entry_1_points: 55, entry_2: 697618, entry_2_points: 55, winner: null },
  { event: 1, entry_1: 691650, entry_1_points: 70, entry_2: 412969, entry_2_points: 71, winner: 412969 },
  { event: 1, entry_1: 385021, entry_1_points: 59, entry_2: 0, entry_2_points: 62, winner: 0 },
];

export default function H2HPreview() {
  return (
    <main className="mx-auto max-w-3xl px-3 py-6">
      <div className="mb-4 rounded-xl border border-sea-border bg-sea-surface/60 px-4 py-3">
        <h1 className="text-lg font-extrabold text-sea-text">
          Preview: Lịch H2H — GW 1
        </h1>
        <p className="mt-1 text-xs text-sea-muted">
          Dữ liệu mẫu để xem UI (FPL chưa công bố lịch thật). Không đọc/ghi Supabase.
        </p>
      </div>
      <H2HList matches={MATCHES} names={NAMES} played={true} />
    </main>
  );
}
