import { DashboardHeader } from "@/components/dashboard-header";
import { HousesCrud } from "@/components/admin/houses-crud";

export default function AdminHousesPage() {
  return (
    <div>
      <DashboardHeader
        title="Rumah"
        description="Tabel semua data rumah"
      />
      <HousesCrud />
    </div>
  );
}
