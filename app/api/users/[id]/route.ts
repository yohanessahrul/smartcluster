import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { deleteUser, updateUser } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(request, async (actor) => {
    const { id } = await context.params;
    const body = await readJsonBody(request);
    return updateUser(id, body, actor);
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(request, async (actor) => {
    const { id } = await context.params;
    return deleteUser(id, actor);
  });
}
