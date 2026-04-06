export type AppRole = "admin" | "superadmin" | "warga" | "finance" | null | undefined;

export function isAdminLikeRole(role: AppRole) {
  return role === "admin" || role === "superadmin";
}

export function isFinanceRole(role: AppRole) {
  return role === "finance";
}

export function canAccessAdminPanel(role: AppRole) {
  return isAdminLikeRole(role) || isFinanceRole(role);
}

export function resolveDashboardPathByRole(role: AppRole) {
  if (isAdminLikeRole(role) || isFinanceRole(role)) {
    return "/dashboard/admin";
  }
  return "/dashboard/warga";
}

