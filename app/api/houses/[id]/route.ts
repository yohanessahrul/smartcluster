import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { ApiHttpError, deleteHouse, updateHouse } from "@/lib/server/smart-api";
import { getWargaScopedDataByEmail } from "@/lib/server/warga-scope";

export const runtime = "nodejs";

function normalizeHouseNomorComparable(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return String(value ?? "").trim();
  const parsed = Number(digits);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 99) {
    return String(parsed).padStart(2, "0");
  }
  return String(value ?? "").trim();
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor, sessionUser) => {
      const { id } = await context.params;
      const body = await readJsonBody(request);

      if (sessionUser?.role === "warga") {
        const scoped = await getWargaScopedDataByEmail(actor);
        if (!scoped.house || scoped.house.id !== id) {
          throw new ApiHttpError(403, "Forbidden.");
        }
        const payloadBlok = String(body.blok ?? "").trim();
        const payloadNomor = normalizeHouseNomorComparable(body.nomor);
        const currentNomor = normalizeHouseNomorComparable(scoped.house.nomor);
        const payloadResidentialStatus = String(body.residential_status ?? "").trim();
        const payloadIsOccupied = Boolean(body.isOccupied);
        if (payloadBlok !== scoped.house.blok || payloadNomor !== currentNomor) {
          throw new ApiHttpError(403, "Warga tidak diizinkan mengubah unit rumah.");
        }
        if (payloadResidentialStatus !== scoped.house.residential_status || payloadIsOccupied !== scoped.house.isOccupied) {
          throw new ApiHttpError(403, "Warga tidak diizinkan mengubah status rumah.");
        }
      }

      return updateHouse(id, body, actor);
    },
    { auth: { roles: ["admin", "superadmin", "warga"] } },
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor) => {
      const { id } = await context.params;
      return deleteHouse(id, actor);
    },
    { auth: { roles: ["admin", "superadmin"] } },
  );
}
