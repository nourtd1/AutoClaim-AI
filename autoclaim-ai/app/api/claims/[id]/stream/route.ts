import { NextRequest } from "next/server";
import { initDb, getClaimById } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 800;
const TERMINAL = new Set(["APPROVED", "REJECTED", "ESCALATED"]);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await initDb();
  const { id } = params;
  const enc = new TextEncoder();
  const frame = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let lastStatus = "", lastStage = "";
      controller.enqueue(frame("connected", { claimId: id }));

      const poll = () => {
        getClaimById(id).then(claim => {
          if (!claim) {
            controller.enqueue(frame("error", { message: `Claim ${id} not found` }));
            controller.close(); return;
          }
          const { status, stage, updatedAt } = claim;
          if (status !== lastStatus || stage !== lastStage) {
            lastStatus = status; lastStage = stage;
            controller.enqueue(frame("stage_update", { claimId: id, status, stage, updatedAt }));
          }
          controller.enqueue(frame("heartbeat", { ts: Date.now() }));
          if (TERMINAL.has(status)) {
            controller.enqueue(frame("done", { claimId: id, finalStatus: status, finalStage: stage }));
            controller.close(); return;
          }
          timer = setTimeout(poll, POLL_MS);
        }).catch(err => {
          console.error("[SSE /stream]", err);
          try { controller.enqueue(frame("error", { message: "Poll error" })); } catch { /* closed */ }
          try { controller.close(); } catch { /* closed */ }
        });
      };

      poll();
    },
    cancel() { if (timer) clearTimeout(timer); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive", "X-Accel-Buffering": "no",
    },
  });
}
