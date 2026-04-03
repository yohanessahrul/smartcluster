import { DashboardHeader } from "@/components/dashboard-header";
import { TransactionsCrud } from "@/components/admin/transactions-crud";

export default function AdminTransactionsPage() {
  return (
    <div>
      <DashboardHeader
        title="Transaksi"
        description="Tabel semua data transaksi"
      />
      <TransactionsCrud />
    </div>
  );
}
