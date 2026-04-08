import { ApiHttpError, ensureBackendReady, getBillGenerateJob, listBillGenerateJobEvents, maybeRunBillGenerateJob } from "@/lib/server/smart-api";
import { requireSessionActor, toErrorResponse } from "@/lib/server/api-route";

export const runtime = "nodejs";

function toSafeEventId(value: string | null) {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  try {
    await ensureBackendReady();
    const session = await requireSessionActor(request, ["admin", "superadmin", "finance"]);
    const url = new URL(request.url);
    const jobId = (url.searchParams.get("jobId") ?? "").trim();
    if (!jobId) {
      throw new ApiHttpError(400, "jobId wajib diisi.");
    }

    const existingJob = await getBillGenerateJob(jobId);
    if (!existingJob) {
      throw new ApiHttpError(404, "Generate job tidak ditemukan.");
    }

    const startAfterEventId = Math.max(
      toSafeEventId(request.headers.get("last-event-id")),
      toSafeEventId(url.searchParams.get("lastEventId")),
    );
    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let lastEventId = startAfterEventId;
        let pingCount = 0;
        const pollIntervalMs = 200;

        const writeChunk = (chunk: string) => {
          if (cancelled) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cancelled = true;
          }
        };

        const writeEvent = (eventType: string, payload: Record<string, unknown>, eventId?: number) => {
          const lines: string[] = [];
          if (typeof eventId === "number" && Number.isFinite(eventId) && eventId > 0) {
            lines.push(`id: ${eventId}`);
          }
          lines.push(`event: ${eventType}`);
          lines.push(`data: ${JSON.stringify(payload)}`);
          writeChunk(`${lines.join("\n")}\n\n`);
        };

        const abortHandler = () => {
          cancelled = true;
        };
        request.signal.addEventListener("abort", abortHandler);
        writeChunk("retry: 2000\n\n");

        const runner = maybeRunBillGenerateJob(jobId, session.email).catch((error) => {
          const message = error instanceof Error ? error.message : "Gagal menjalankan generate job.";
          writeEvent("failed", { job_id: jobId, message });
        });

        try {
          while (!cancelled) {
            const events = await listBillGenerateJobEvents(jobId, lastEventId, 500);
            if (events.length) {
              for (const event of events) {
                writeEvent(event.event_type, event.payload, event.id);
                lastEventId = event.id;
              }
            }

            const latestJob = await getBillGenerateJob(jobId);
            if (!latestJob) {
              writeEvent("failed", { job_id: jobId, message: "Generate job tidak ditemukan." });
              break;
            }

            if ((latestJob.status === "completed" || latestJob.status === "failed") && !events.length) {
              const message =
                latestJob.status === "completed"
                  ? `Generate ${latestJob.periode} selesai.`
                  : latestJob.error_message || "Generate IPL gagal.";
              writeEvent(latestJob.status === "completed" ? "completed" : "failed", {
                ...latestJob,
                message,
              });
              break;
            }

            pingCount += 1;
            if (pingCount % 75 === 0) {
              writeChunk(`: ping ${Date.now()}\n\n`);
            }

            await wait(pollIntervalMs);
          }

          await runner.catch(() => null);
        } finally {
          request.signal.removeEventListener("abort", abortHandler);
          cancelled = true;
          try {
            controller.close();
          } catch {}
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
