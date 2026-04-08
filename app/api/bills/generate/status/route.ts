import { handleApi } from "@/lib/server/api-route";
import { ApiHttpError, getBillGenerateJob, maybeRunBillGenerateJob } from "@/lib/server/smart-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleApi(
    request,
    async (actor) => {
      const url = new URL(request.url);
      const jobId = (url.searchParams.get("jobId") ?? "").trim();
      if (!jobId) {
        throw new ApiHttpError(400, "jobId wajib diisi.");
      }

      await maybeRunBillGenerateJob(jobId, actor).catch(() => null);
      const job = await getBillGenerateJob(jobId);
      if (!job) {
        throw new ApiHttpError(404, "Generate job tidak ditemukan.");
      }
      return job;
    },
    { auth: { roles: ["admin", "superadmin", "finance"] } },
  );
}
