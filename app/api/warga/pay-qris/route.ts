import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { payBillWithQris } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(request, async (actor) => {
    const body = await readJsonBody(request);
    return payBillWithQris({ billId: body.billId }, actor);
  });
}
