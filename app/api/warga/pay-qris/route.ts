import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { payBillWithQris } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const body = await readJsonBody(request);
      return payBillWithQris(
        {
          billId: body.billId,
          payment_method: body.payment_method,
          payment_proof_url: body.payment_proof_url,
        },
        actor,
      );
    },
    { auth: { roles: ["warga"] } },
  );
}
