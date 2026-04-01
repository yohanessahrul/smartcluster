import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { createHouse, listHouses } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => listHouses());
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return createHouse(body, actor);
    },
    { status: 201 },
  );
}
