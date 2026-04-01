import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { createUser, listUsers } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => listUsers());
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return createUser(body, actor);
    },
    { status: 201 },
  );
}
