import { DashboardHeader } from "@/components/dashboard-header";
import { UsersCrud } from "@/components/admin/users-crud";

export default function AdminUsersPage() {
  return (
    <div>
      <DashboardHeader title="Users" description="Tabel data pengguna sesuai model: id, name, email, phone, role." />
      <UsersCrud />
    </div>
  );
}
