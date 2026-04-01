import { DashboardHeader } from "@/components/dashboard-header";
import { HousesCrud } from "@/components/admin/houses-crud";

export default function AdminHousesPage() {
  return (
    <div>
      <DashboardHeader
        title="Houses"
        description="Tabel data rumah: unit, residential_status, isOccupied, dan linked_users (maks 2 email per house)."
      />
      <HousesCrud />
    </div>
  );
}
