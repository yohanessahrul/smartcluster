import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { createTransaction, listTransactions } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(request, async () => listTransactions());
}

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return createTransaction(body, actor);
    },
    { status: 201 },
  );
}
