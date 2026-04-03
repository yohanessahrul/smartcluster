import { DashboardHeader } from "@/components/dashboard-header";
import { UsersCrud } from "@/components/admin/users-crud";

export default function AdminUsersPage() {
  return (
    <div>
      <DashboardHeader title="Pengguna" description="Tabel semua data pengguna" />
      <UsersCrud />
    </div>
  );
}
