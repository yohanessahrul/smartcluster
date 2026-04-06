import { handleApi } from "@/lib/server/api-route";
import { getHealthStatus } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(
    request,
    async () => getHealthStatus(),
    { auth: { roles: ["admin", "superadmin", "finance", "warga"] } },
  );
}
