import nodemailer from "nodemailer";
import { getClaimById, getReviewerById, addStageEvent, getAllClaims, setMaestroInstanceId, updateClaimStatus } from "./db";
import { extractClaimData, validateClaim } from "./agents";
import { maestroStartClaim, maestroAdvanceStage } from "./maestro";
import type { ClaimStage } from "./types";

async function notifyReviewer(claimId: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) return;

  const claim = await getClaimById(claimId);
  if (!claim?.assignedTo) return;
  const reviewer = await getReviewerById(claim.assignedTo);
  if (!reviewer?.email) return;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const claimUrl = `${baseUrl}/claims/${claimId}`;

  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST, port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transport.sendMail({
      from: SMTP_FROM, to: reviewer.email,
      subject: `[AutoClaim AI] Review Required — Claim #${claimId.slice(-8)}`,
      html: `<div style="font-family:sans-serif;max-width:560px">
        <h2>AutoClaim AI — Review Required</h2>
        <p>Hi ${reviewer.name},</p>
        <p>Claim #${claimId.slice(-8)} (${claim.claimantName}) requires your review.</p>
        <a href="${claimUrl}" style="background:#7C3AED;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Review Claim →</a>
      </div>`,
    });
  } catch (err) {
    console.error(`[orchestrator] Email error for claim ${claimId}:`, err);
  }
}

export interface OrchestratorState {
  claimId: string; currentStage: ClaimStage; nextAction: string;
  canAutoProgress: boolean; blockedReason: string | null; estimatedCompletionMinutes: number;
}

const processingQueue = new Map<string, Promise<void>>();
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class ClaimOrchestrator {
  async processNewClaim(claimId: string): Promise<void> {
    const existing = processingQueue.get(claimId);
    if (existing) return existing;
    const task = this._runFullWorkflow(claimId);
    processingQueue.set(claimId, task);
    try { await task; } finally { processingQueue.delete(claimId); }
  }

  private async _runFullWorkflow(claimId: string): Promise<void> {
    const claim = await getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    // Step 1 — INTAKE visible in DB so SSE catches it
    await updateClaimStatus(claimId, "SUBMITTED", "INTAKE");
    await addStageEvent({ claimId, stage: "INTAKE", status: "SUBMITTED", actor: "ROBOT", notes: "Orchestrator: workflow started" });
    await delay(1200);

    const maestroInstanceId = await maestroStartClaim(claimId, {
      policyNumber: claim.policyNumber, claimantName: claim.claimantName,
      claimType: claim.claimType, claimAmount: claim.claimAmount, currency: claim.currency,
    });
    if (maestroInstanceId) await setMaestroInstanceId(claimId, maestroInstanceId);

    // Step 2 — write EXTRACTING to DB before Claude runs so SSE sees it
    await updateClaimStatus(claimId, "EXTRACTING", "EXTRACTION");
    await addStageEvent({ claimId, stage: "EXTRACTION", status: "EXTRACTING", actor: "ROBOT", notes: "Orchestrator: starting extraction" });
    await delay(800);
    const extracted = await extractClaimData(claimId);
    await addStageEvent({ claimId, stage: "EXTRACTION", status: "VALIDATING", actor: "ROBOT", notes: `Orchestrator: extraction complete, confidence=${extracted.confidence.toFixed(2)}` });

    if (maestroInstanceId) await maestroAdvanceStage(maestroInstanceId, "EXTRACTION", { confidence: extracted.confidence, extractedFields: Object.keys(extracted).length });

    // Step 3 — write VALIDATING to DB before validation logic runs
    await updateClaimStatus(claimId, "VALIDATING", "VALIDATION");
    await addStageEvent({ claimId, stage: "VALIDATION", status: "VALIDATING", actor: "ROBOT", notes: "Orchestrator: starting validation" });
    await delay(800);
    const result = await validateClaim(claimId);

    if (maestroInstanceId) await maestroAdvanceStage(maestroInstanceId, "VALIDATION", { isValid: result.isValid, riskScore: result.riskScore });

    const routed = await getClaimById(claimId);
    if (!routed) return;

    if (routed.status === "APPROVED") {
      await addStageEvent({ claimId, stage: "RESOLUTION", status: "APPROVED", actor: "ROBOT", notes: `Orchestrator: auto-approved. Risk score: ${result.riskScore}` });
      if (maestroInstanceId) await maestroAdvanceStage(maestroInstanceId, "RESOLUTION", { outcome: "AUTO_APPROVED" });
    } else {
      await addStageEvent({ claimId, stage: routed.stage, status: routed.status, actor: "ROBOT", notes: `Orchestrator: routed to human review. riskScore=${result.riskScore}` });
      await notifyReviewer(claimId);
      if (maestroInstanceId) await maestroAdvanceStage(maestroInstanceId, "HUMAN_REVIEW", { riskScore: result.riskScore, reasons: result.errors });
    }
  }

  async resumeClaim(claimId: string, fromStage: ClaimStage): Promise<void> {
    const existing = processingQueue.get(claimId);
    if (existing) return existing;
    const task = this._resumeFrom(claimId, fromStage);
    processingQueue.set(claimId, task);
    try { await task; } finally { processingQueue.delete(claimId); }
  }

  private async _resumeFrom(claimId: string, fromStage: ClaimStage): Promise<void> {
    const claim = await getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    await addStageEvent({ claimId, stage: fromStage, status: claim.status, actor: "ROBOT", notes: `Orchestrator: resuming from ${fromStage}` });

    switch (fromStage) {
      case "INTAKE":
        await this._runFullWorkflow(claimId);
        return;
      case "EXTRACTION": {
        const extracted = await extractClaimData(claimId);
        await addStageEvent({ claimId, stage: "EXTRACTION", status: "VALIDATING", actor: "ROBOT", notes: `Orchestrator: extraction complete after resume, confidence=${extracted.confidence.toFixed(2)}` });
        const result = await validateClaim(claimId);
        const after = await getClaimById(claimId);
        if (after?.status === "APPROVED") await addStageEvent({ claimId, stage: "RESOLUTION", status: "APPROVED", actor: "ROBOT", notes: `Auto-approved after resume. Risk score: ${result.riskScore}` });
        return;
      }
      case "VALIDATION": {
        const result = await validateClaim(claimId);
        const after = await getClaimById(claimId);
        if (after?.status === "APPROVED") await addStageEvent({ claimId, stage: "RESOLUTION", status: "APPROVED", actor: "ROBOT", notes: `Auto-approved after resume. Risk score: ${result.riskScore}` });
        return;
      }
      case "EXCEPTION_ROUTING":
      case "HUMAN_REVIEW":
        await addStageEvent({ claimId, stage: fromStage, status: claim.status, actor: "ROBOT", notes: `Stage ${fromStage} requires human decision` });
        return;
      case "RESOLUTION":
        return;
    }
  }

  async processPendingClaims(): Promise<{ processed: number; errors: number }> {
    const all = await getAllClaims();
    const stalled = all.filter(c =>
      (c.status === "SUBMITTED"  && c.stage === "INTAKE") ||
      (c.status === "EXTRACTING" && c.stage === "EXTRACTION") ||
      (c.status === "VALIDATING" && c.stage === "VALIDATION")
    );
    let processed = 0, errors = 0;
    const results = await Promise.allSettled(
      stalled.filter(c => !processingQueue.has(c.id))
        .map(c => this.resumeClaim(c.id, c.stage).then(() => { processed++; }))
    );
    for (const r of results) if (r.status === "rejected") { console.error("[Orchestrator]", r.reason); errors++; }
    return { processed, errors };
  }

  async getClaimState(claimId: string): Promise<OrchestratorState> {
    const claim = await getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);
    const isInFlight = processingQueue.has(claimId);

    const map: Record<string, { nextAction: string; canAutoProgress: boolean; blockedReason: string | null; estimatedCompletionMinutes: number }> = {
      SUBMITTED:      { nextAction: "Start extraction",    canAutoProgress: true,  blockedReason: null,                               estimatedCompletionMinutes: 5 },
      EXTRACTING:     { nextAction: "Awaiting extraction", canAutoProgress: true,  blockedReason: isInFlight ? null : "Stalled",      estimatedCompletionMinutes: 3 },
      VALIDATING:     { nextAction: "Awaiting validation", canAutoProgress: true,  blockedReason: isInFlight ? null : "Stalled",      estimatedCompletionMinutes: 2 },
      PENDING_REVIEW: { nextAction: "Awaiting human",      canAutoProgress: false, blockedReason: "Pending human decision",           estimatedCompletionMinutes: 60 },
      ESCALATED:      { nextAction: "Awaiting senior",     canAutoProgress: false, blockedReason: "Requires senior reviewer",         estimatedCompletionMinutes: 120 },
      APPROVED:       { nextAction: "None — resolved",     canAutoProgress: false, blockedReason: null,                               estimatedCompletionMinutes: 0 },
      REJECTED:       { nextAction: "None — resolved",     canAutoProgress: false, blockedReason: null,                               estimatedCompletionMinutes: 0 },
    };

    const config = map[claim.status] ?? { nextAction: "Unknown", canAutoProgress: false, blockedReason: `Unexpected status: ${claim.status}`, estimatedCompletionMinutes: 0 };
    return { claimId, currentStage: claim.stage, ...config };
  }
}

export const orchestrator = new ClaimOrchestrator();
