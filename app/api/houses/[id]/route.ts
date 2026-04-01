import { handleApi, readJsonBody } from "@/lib/server/api-route";
import { deleteHouse, updateHouse } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(request, async (actor) => {
    const { id } = await context.params;
    const body = await readJsonBody(request);
    return updateHouse(id, body, actor);
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleApi(request, async (actor) => {
    const { id } = await context.params;
    return deleteHouse(id, actor);
  });
}
