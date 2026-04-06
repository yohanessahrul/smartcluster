import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { ApiHttpError, deleteUser, updateUser } from "@/lib/server/smart-api";
import { query } from "@/lib/server/db";
import { getWargaScopedDataByEmail } from "@/lib/server/warga-scope";

export const runtime = "nodejs";

type UserRoleRow = {
  role: "admin" | "superadmin" | "warga" | "finance";
};

async function ensureAdminCannotMutateSuperadmin(sessionRole: UserRoleRow["role"] | undefined, targetId: string) {
  if (sessionRole !== "admin") return;
  const result = await query<UserRoleRow>("SELECT role FROM users WHERE id=$1 LIMIT 1", [targetId]);
  const target = result.rows[0];
  if (!target) return;
  if (target.role === "superadmin") {
    throw new ApiHttpError(403, "Admin tidak diizinkan mengubah atau menghapus data superadmin.");
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      const { id } = await context.params;
      const body = await readJsonBody(request);

      if (sessionUser?.role === "warga") {
        const scoped = await getWargaScopedDataByEmail(actor);
        const allowedIds = new Set((scoped.linkedUsers ?? []).map((item) => item.id));
        if (!allowedIds.has(id)) {
          throw new ApiHttpError(403, "Warga hanya bisa mengubah data user yang terhubung ke rumahnya.");
        }
        const nextRole = String(body.role ?? "").trim().toLowerCase();
        if (nextRole && nextRole !== "warga") {
          throw new ApiHttpError(403, "Warga tidak diizinkan mengubah role user.");
        }
      }
      await ensureAdminCannotMutateSuperadmin(sessionUser?.role, id);

      return updateUser(id, body, actor);
    },
    { auth: { roles: ["admin", "superadmin", "warga"] } },
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      const { id } = await context.params;
      await ensureAdminCannotMutateSuperadmin(sessionUser?.role, id);
      return deleteUser(id, actor);
    },
    { auth: { roles: ["admin", "superadmin"] } },
  );
}
