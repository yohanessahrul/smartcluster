import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { deleteTransaction, updateTransaction } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor) => {
      const { id } = await context.params;
      const body = await readJsonBody(request);
      return updateTransaction(id, body, actor);
    },
    { auth: { roles: ["admin", "superadmin", "finance"] } },
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(
    request,
    async (actor) => {
      const { id } = await context.params;
      return deleteTransaction(id, actor);
    },
    { auth: { roles: ["admin", "superadmin", "finance"] } },
  );
}
