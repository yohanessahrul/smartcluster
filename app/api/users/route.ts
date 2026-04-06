import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { ApiHttpError, createUser, listUsers } from "@/lib/server/smart-api";
import { getWargaScopedDataByEmail } from "@/lib/server/warga-scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      if (sessionUser?.role === "warga") {
        const scoped = await getWargaScopedDataByEmail(actor);
        return scoped.linkedUsers;
      }
      return listUsers();
    },
    {
      auth: { roles: ["admin", "superadmin", "warga"] },
    },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      const body = await readJsonBody(request);

      if (sessionUser?.role === "warga") {
        const scoped = await getWargaScopedDataByEmail(actor);
        if (!scoped.house) {
          throw new ApiHttpError(403, "Warga belum terhubung ke data rumah.");
        }
        if (scoped.linkedUsers.length >= 2) {
          throw new ApiHttpError(403, "Rumah ini sudah memiliki Primary dan Secondary.");
        }
        const nextRole = String(body.role ?? "").trim().toLowerCase();
        if (!nextRole || nextRole !== "warga") {
          throw new ApiHttpError(403, "Warga hanya bisa membuat user dengan role warga.");
        }
      }

      return createUser(body, actor);
    },
    { status: 201, auth: { roles: ["admin", "superadmin", "warga"] } },
  );
}
