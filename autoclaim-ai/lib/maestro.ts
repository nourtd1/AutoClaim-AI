/**
 * lib/maestro.ts — UiPath Maestro integration layer
 *
 * Architecture: Maestro tracks pipeline flow (BPMN 5 stages).
 * Human review is handled by the Next.js ReviewPanel (no Action Center dependency).
 *
 * Required env vars:
 *   UIPATH_BASE_URL         https://cloud.uipath.com/{org}/{tenant}
 *   UIPATH_PAT_TOKEN        Personal Access Token
 *   UIPATH_FOLDER_NAME      Orchestrator folder (e.g. "Solution 1")
 *   UIPATH_API_TRIGGER_URL  Full slug URL from Orchestrator → API Triggers
 */

const isConfigured = () =>
  !!(process.env.UIPATH_PAT_TOKEN && process.env.UIPATH_API_TRIGGER_URL);

function headers(): HeadersInit {
  return {
    "Authorization":       `Bearer ${process.env.UIPATH_PAT_TOKEN ?? ""}`,
    "X-UIPATH-FolderPath": process.env.UIPATH_FOLDER_NAME ?? "Solution 1",
    "Content-Type":        "application/json",
  };
}

function orc(): string {
  const trigger = process.env.UIPATH_API_TRIGGER_URL ?? "";
  const match = trigger.match(/^(https:\/\/cloud\.uipath\.com\/[^/]+\/[^/]+\/orchestrator_)/);
  return match?.[1] ?? `${process.env.UIPATH_BASE_URL ?? ""}/orchestrator_`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MaestroInstance {
  instanceId: string;
  stage: string;
  status: "running" | "pending_human" | "completed" | "faulted";
}

// ── 1. Start process instance ─────────────────────────────────────────────────

export async function maestroStartClaim(
  claimId: string,
  payload: Record<string, unknown>
): Promise<string | null> {
  if (!isConfigured()) return null;

  try {
    const triggerUrl = process.env.UIPATH_API_TRIGGER_URL!;
    const res = await fetch(triggerUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        claimId,
        currentStage:    "INTAKE",
        submittedAt:     new Date().toISOString(),
        skipHumanReview: false,
        ...payload,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Maestro] startClaim failed: ${res.status} — ${text.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as Record<string, unknown>;
    const instanceId = String(data.jobId ?? data.id ?? data.Id ?? "");
    console.log(`[Maestro] Process started — instanceId: ${instanceId}`);
    return instanceId || null;
  } catch (err) {
    console.error("[Maestro] startClaim error:", err);
    return null;
  }
}

// ── 2. Stage tracking (local log — BPMN advances via serverless robot) ─────────

export async function maestroAdvanceStage(
  instanceId: string,
  stage: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  if (instanceId && stage) {
    console.log(`[Maestro] Stage tracked locally → ${stage} (instanceId: ${instanceId})`, payload);
  }
}

// ── 3. Human review — handled by Next.js UI, not Action Center ────────────────
// Action Center requires a paid add-on. Human review decisions are captured
// via POST /api/review/[claimId]/decision and stored in the local DB.
// Maestro tracks pipeline flow only.

export async function maestroFindHumanTask(
  instanceId: string
): Promise<number | null> {
  console.log(`[Maestro] Human review handled by Next.js ReviewPanel — instance: ${instanceId}`);
  return null;
}

export async function maestroCompleteHumanReview(
  instanceId: string,
  decision: string,
  notes: string
): Promise<void> {
  console.log(`[Maestro] Human decision recorded locally — instance: ${instanceId}, decision: ${decision}, notes: ${notes.slice(0, 50)}`);
  // Future: when Action Center is available, call CompleteTask API here
}

// ── 4. Get job status ─────────────────────────────────────────────────────────

export async function maestroGetStatus(
  instanceId: string
): Promise<MaestroInstance | null> {
  if (!isConfigured() || !instanceId) return null;

  try {
    const res = await fetch(
      `${orc()}/odata/Jobs(${instanceId})`,
      { headers: headers() }
    );

    if (!res.ok) return null;

    const job = await res.json() as Record<string, unknown>;
    const stateMap: Record<string, MaestroInstance["status"]> = {
      Running:    "running",
      Pending:    "running",
      Suspended:  "pending_human",
      Successful: "completed",
      Faulted:    "faulted",
      Stopped:    "faulted",
    };

    return {
      instanceId,
      stage:  "RESOLUTION",
      status: stateMap[String(job.State)] ?? "running",
    };
  } catch (err) {
    console.error("[Maestro] getStatus error:", err);
    return null;
  }
}
