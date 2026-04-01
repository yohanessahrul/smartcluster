import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { createBill, listBills } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => listBills());
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return createBill(body, actor);
    },
    { status: 201 },
  );
}
