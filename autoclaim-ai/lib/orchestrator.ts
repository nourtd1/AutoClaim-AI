import nodemailer from "nodemailer";
import { getClaimById, getReviewerById, addStageEvent, getAllClaims, setMaestroInstanceId } from "./db";
import { extractClaimData, validateClaim } from "./agents";
import {
  maestroStartClaim,
  maestroAdvanceStage,
} from "./maestro";
import type { ClaimStage } from "./types";

// ── Email notification (no-op if SMTP not configured) ────────────────────────

async function notifyReviewer(claimId: string): Promise<void> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    console.warn("[orchestrator] SMTP not configured — skipping reviewer email");
    return;
  }

  const claim = getClaimById(claimId);
  if (!claim?.assignedTo) return;

  const reviewer = getReviewerById(claim.assignedTo);
  if (!reviewer?.email) return;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const claimUrl = `${baseUrl}/claims/${claimId}`;

  try {
    const transport = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transport.sendMail({
      from:    SMTP_FROM,
      to:      reviewer.email,
      subject: `[AutoClaim AI] Review Required — Claim #${claimId.slice(-8)}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#10B981,#7C3AED);padding:24px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">AutoClaim AI</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">UiPath AgentHack 2026 · Human Review Required</p>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p style="color:#374151">Hi ${reviewer.name},</p>
            <p style="color:#374151">A claim has been routed for your review:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
              <tr><td style="padding:8px;color:#6b7280">Claim ID</td><td style="padding:8px;font-weight:600">#${claimId.slice(-8)}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Claimant</td><td style="padding:8px;font-weight:600">${claim.claimantName}</td></tr>
              <tr><td style="padding:8px;color:#6b7280">Type</td><td style="padding:8px">${claim.claimType.replace(/_/g," ")}</td></tr>
              <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:600">${claim.claimAmount} ${claim.currency}</td></tr>
              <tr><td style="padding:8px;color:#6b7280">Stage</td><td style="padding:8px;color:#d97706;font-weight:600">HUMAN_REVIEW</td></tr>
            </table>
            <a href="${claimUrl}" style="display:inline-block;background:#7C3AED;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Review Claim →
            </a>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px">AutoClaim AI · UiPath AgentHack 2026</p>
          </div>
        </div>
      `,
    });

    console.log(`[orchestrator] Review email sent to ${reviewer.email} for claim ${claimId}`);
  } catch (err) {
    console.error(`[orchestrator] Failed to send reviewer email for claim ${claimId}:`, err);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrchestratorState {
  claimId: string;
  currentStage: ClaimStage;
  nextAction: string;
  canAutoProgress: boolean;
  blockedReason: string | null;
  estimatedCompletionMinutes: number;
}

// ── In-memory processing queue ─────────────────────────────────────────────────
// Module-level so it persists across requests in the same Node.js process.
const processingQueue = new Map<string, Promise<void>>();

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ── ClaimOrchestrator ─────────────────────────────────────────────────────────

export class ClaimOrchestrator {
  // ── Full workflow ──────────────────────────────────────────────────────────

  async processNewClaim(claimId: string): Promise<void> {
    const existing = processingQueue.get(claimId);
    if (existing) return existing;

    const task = this._runFullWorkflow(claimId);
    processingQueue.set(claimId, task);
    try {
      await task;
    } finally {
      processingQueue.delete(claimId);
    }
  }

  private async _runFullWorkflow(claimId: string): Promise<void> {
    const claim = getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    // ── INTAKE ────────────────────────────────────────────────────────────────
    addStageEvent({
      claimId,
      stage: "INTAKE",
      status: "SUBMITTED",
      actor: "ROBOT",
      notes: "Orchestrator: workflow started, processing intake",
    });

    // Start a real Maestro process instance (no-op if not configured)
    const maestroInstanceId = await maestroStartClaim(claimId, {
      policyNumber: claim.policyNumber,
      claimantName: claim.claimantName,
      claimType:    claim.claimType,
      claimAmount:  claim.claimAmount,
      currency:     claim.currency,
    });

    // Persist the Maestro instanceId so the decision route can use it later
    if (maestroInstanceId) {
      setMaestroInstanceId(claimId, maestroInstanceId);
    }

    await delay(500);

    // ── EXTRACTION ────────────────────────────────────────────────────────────
    addStageEvent({
      claimId,
      stage: "EXTRACTION",
      status: "EXTRACTING",
      actor: "ROBOT",
      notes: "Orchestrator: starting extraction phase",
    });
    const extracted = await extractClaimData(claimId);
    addStageEvent({
      claimId,
      stage: "EXTRACTION",
      status: "VALIDATING",
      actor: "ROBOT",
      notes: `Orchestrator: extraction complete, confidence=${extracted.confidence.toFixed(2)}`,
    });

    // Advance Maestro BPMN to EXTRACTION task
    if (maestroInstanceId) {
      await maestroAdvanceStage(maestroInstanceId, "EXTRACTION", {
        confidence: extracted.confidence,
        extractedFields: Object.keys(extracted).length,
      });
    }

    // ── VALIDATION ────────────────────────────────────────────────────────────
    addStageEvent({
      claimId,
      stage: "VALIDATION",
      status: "VALIDATING",
      actor: "ROBOT",
      notes: "Orchestrator: starting validation phase",
    });
    const result = await validateClaim(claimId);

    // Advance Maestro BPMN to VALIDATION task
    if (maestroInstanceId) {
      await maestroAdvanceStage(maestroInstanceId, "VALIDATION", {
        isValid:   result.isValid,
        riskScore: result.riskScore,
      });
    }

    // ── ROUTING ───────────────────────────────────────────────────────────────
    const routed = getClaimById(claimId);
    if (!routed) return;

    if (routed.status === "APPROVED") {
      addStageEvent({
        claimId,
        stage: "RESOLUTION",
        status: "APPROVED",
        actor: "ROBOT",
        notes: `Orchestrator: auto-approved. Risk score: ${result.riskScore}`,
      });
      if (maestroInstanceId) {
        await maestroAdvanceStage(maestroInstanceId, "RESOLUTION", { outcome: "AUTO_APPROVED" });
      }
    } else {
      addStageEvent({
        claimId,
        stage: routed.stage,
        status: routed.status,
        actor: "ROBOT",
        notes: `Orchestrator: routed to human review. status=${routed.status}, riskScore=${result.riskScore}`,
      });
      // Send email to assigned reviewer
      await notifyReviewer(claimId);

      // Maestro BPMN stays at HUMAN_REVIEW User Task — Action Center will await
      if (maestroInstanceId) {
        await maestroAdvanceStage(maestroInstanceId, "HUMAN_REVIEW", {
          riskScore: result.riskScore,
          reasons:   result.errors,
        });
      }
    }
  }

  // ── Resume from a given stage ──────────────────────────────────────────────

  async resumeClaim(claimId: string, fromStage: ClaimStage): Promise<void> {
    const existing = processingQueue.get(claimId);
    if (existing) return existing;

    const task = this._resumeFrom(claimId, fromStage);
    processingQueue.set(claimId, task);
    try {
      await task;
    } finally {
      processingQueue.delete(claimId);
    }
  }

  private async _resumeFrom(claimId: string, fromStage: ClaimStage): Promise<void> {
    const claim = getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    addStageEvent({
      claimId,
      stage: fromStage,
      status: claim.status,
      actor: "ROBOT",
      notes: `Orchestrator: resuming workflow from stage ${fromStage}`,
    });

    switch (fromStage) {
      case "INTAKE":
        // Full re-run (queue already managed by resumeClaim, call private method directly)
        await this._runFullWorkflow(claimId);
        return;

      case "EXTRACTION": {
        const extracted = await extractClaimData(claimId);
        addStageEvent({
          claimId,
          stage: "EXTRACTION",
          status: "VALIDATING",
          actor: "ROBOT",
          notes: `Orchestrator: extraction complete after resume, confidence=${extracted.confidence.toFixed(2)}`,
        });
        // Fall through to validation
        const result = await validateClaim(claimId);
        const afterExtResume = getClaimById(claimId);
        if (afterExtResume?.status === "APPROVED") {
          addStageEvent({
            claimId,
            stage: "RESOLUTION",
            status: "APPROVED",
            actor: "ROBOT",
            notes: `Orchestrator: auto-approved after resume. Risk score: ${result.riskScore}`,
          });
        }
        return;
      }

      case "VALIDATION": {
        const result = await validateClaim(claimId);
        const afterValResume = getClaimById(claimId);
        if (afterValResume?.status === "APPROVED") {
          addStageEvent({
            claimId,
            stage: "RESOLUTION",
            status: "APPROVED",
            actor: "ROBOT",
            notes: `Orchestrator: auto-approved after resume. Risk score: ${result.riskScore}`,
          });
        }
        return;
      }

      case "EXCEPTION_ROUTING":
      case "HUMAN_REVIEW":
        // Requires a human decision — cannot auto-progress
        addStageEvent({
          claimId,
          stage: fromStage,
          status: claim.status,
          actor: "ROBOT",
          notes: `Orchestrator: stage ${fromStage} requires human decision, cannot auto-progress`,
        });
        return;

      case "RESOLUTION":
        // Terminal state — nothing to do
        return;
    }
  }

  // ── Poll stalled claims ────────────────────────────────────────────────────

  async processPendingClaims(): Promise<{ processed: number; errors: number }> {
    const stalled = getAllClaims().filter(
      (c) =>
        (c.status === "SUBMITTED" && c.stage === "INTAKE") ||
        (c.status === "EXTRACTING" && c.stage === "EXTRACTION") ||
        (c.status === "VALIDATING" && c.stage === "VALIDATION")
    );

    let processed = 0;
    let errors = 0;

    const results = await Promise.allSettled(
      stalled
        .filter((c) => !processingQueue.has(c.id))
        .map((c) =>
          this.resumeClaim(c.id, c.stage).then(() => {
            processed++;
          })
        )
    );

    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[Orchestrator] processPendingClaims error:", r.reason);
        errors++;
      }
    }

    return { processed, errors };
  }

  // ── Claim state snapshot ───────────────────────────────────────────────────

  getClaimState(claimId: string): OrchestratorState {
    const claim = getClaimById(claimId);
    if (!claim) throw new Error(`Claim not found: ${claimId}`);

    const isInFlight = processingQueue.has(claimId);

    type StateConfig = {
      nextAction: string;
      canAutoProgress: boolean;
      blockedReason: string | null;
      estimatedCompletionMinutes: number;
    };

    const stateMap: Record<string, StateConfig> = {
      SUBMITTED: {
        nextAction: "Start extraction",
        canAutoProgress: true,
        blockedReason: null,
        estimatedCompletionMinutes: 5,
      },
      EXTRACTING: {
        nextAction: "Awaiting extraction",
        canAutoProgress: true,
        blockedReason: isInFlight ? null : "Extraction stalled — retry required",
        estimatedCompletionMinutes: 3,
      },
      VALIDATING: {
        nextAction: "Awaiting validation",
        canAutoProgress: true,
        blockedReason: isInFlight ? null : "Validation stalled — retry required",
        estimatedCompletionMinutes: 2,
      },
      PENDING_REVIEW: {
        nextAction: "Awaiting human decision",
        canAutoProgress: false,
        blockedReason: "Pending human reviewer decision",
        estimatedCompletionMinutes: 60,
      },
      ESCALATED: {
        nextAction: "Awaiting senior review",
        canAutoProgress: false,
        blockedReason: "Escalated — requires senior reviewer",
        estimatedCompletionMinutes: 120,
      },
      APPROVED: {
        nextAction: "None — claim resolved",
        canAutoProgress: false,
        blockedReason: null,
        estimatedCompletionMinutes: 0,
      },
      REJECTED: {
        nextAction: "None — claim resolved",
        canAutoProgress: false,
        blockedReason: null,
        estimatedCompletionMinutes: 0,
      },
    };

    const config = stateMap[claim.status] ?? {
      nextAction: "Unknown state",
      canAutoProgress: false,
      blockedReason: `Unexpected status: ${claim.status}`,
      estimatedCompletionMinutes: 0,
    };

    return {
      claimId,
      currentStage: claim.stage,
      ...config,
    };
  }
}

export const orchestrator = new ClaimOrchestrator();
