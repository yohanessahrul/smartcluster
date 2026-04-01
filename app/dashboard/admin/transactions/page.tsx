import { DashboardHeader } from "@/components/dashboard-header";
import { TransactionsCrud } from "@/components/admin/transactions-crud";

export default function AdminTransactionsPage() {
  return (
    <div>
      <DashboardHeader
        title="Transactions"
        description="Tabel data transaksi."
      />
      <TransactionsCrud />
    </div>
  );
}
