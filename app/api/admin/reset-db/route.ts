import { handleApi } from "@/lib/server/api-route";
import { resetDatabaseExceptUsers } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      return resetDatabaseExceptUsers(actor);
    },
    { auth: { roles: ["superadmin"] } },
  );
}
