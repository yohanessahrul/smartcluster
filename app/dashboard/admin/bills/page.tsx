import { DashboardHeader } from "@/components/dashboard-header";
import { BillsCrud } from "@/components/admin/bills-crud";

export default function AdminBillsPage() {
  return (
    <div>
      <DashboardHeader
        title="IPL"
        description="Tabel semua data Iuran Pemeliharaan Lingkungan (IPL)"
      />
      <BillsCrud />
    </div>
  );
}
