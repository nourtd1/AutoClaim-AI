import { getClaimById, addStageEvent, getAllClaims } from "./db";
import { extractClaimData, validateClaim } from "./agents";
import type { ClaimStage } from "./types";

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

    // Step 1 — INTAKE
    addStageEvent({
      claimId,
      stage: "INTAKE",
      status: "SUBMITTED",
      actor: "ROBOT",
      notes: "Orchestrator: workflow started, processing intake",
    });
    await delay(500);

    // Step 2 — EXTRACTION
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

    // Step 3 — VALIDATION
    addStageEvent({
      claimId,
      stage: "VALIDATION",
      status: "VALIDATING",
      actor: "ROBOT",
      notes: "Orchestrator: starting validation phase",
    });
    const result = await validateClaim(claimId);

    // Step 4 — routing outcome (status already updated by routeCase inside validateClaim)
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
    } else {
      addStageEvent({
        claimId,
        stage: routed.stage,
        status: routed.status,
        actor: "ROBOT",
        notes: `Orchestrator: routed to human review. status=${routed.status}, riskScore=${result.riskScore}`,
      });
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
