import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { createHouse, listHouses } from "@/lib/server/smart-api";
import { getWargaScopedDataByEmail } from "@/lib/server/warga-scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      if (sessionUser?.role === "warga") {
        const scoped = await getWargaScopedDataByEmail(actor);
        return scoped.house ? [scoped.house] : [];
      }
      return listHouses();
    },
    { auth: { roles: ["admin", "superadmin", "finance", "warga"] } },
  );
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return createHouse(body, actor);
    },
    { status: 201, auth: { roles: ["admin", "superadmin"] } },
  );
}
