import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  initDb,
  getClaimById,
  getReviewerById,
  getReviewersByRole,
  updateClaimStatus,
  appendReviewNotes,
  assignReviewer,
  addStageEvent,
  updateClaim,
} from "@/lib/db";

initDb();

const DecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "ESCALATE", "REQUEST_MORE_INFO"]),
  reviewerId: z.string().min(1, "reviewerId is required"),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
  adjustedAmount: z.number().positive().optional(),
});

// ── POST /api/review/[claimId]/decision ───────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { claimId: string } }
) {
  const { claimId } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation failed";
    return NextResponse.json(
      { data: null, error: msg, code: "VALIDATION_ERROR" },
      { status: 422 }
    );
  }

  const { decision, reviewerId, notes, adjustedAmount } = parsed.data;

  try {
    const claim = getClaimById(claimId);
    if (!claim) {
      return NextResponse.json(
        { data: null, error: `Claim not found: ${claimId}` },
        { status: 404 }
      );
    }

    const reviewer = getReviewerById(reviewerId);
    if (!reviewer) {
      return NextResponse.json(
        { data: null, error: `Reviewer not found: ${reviewerId}` },
        { status: 404 }
      );
    }
    if (!reviewer.isAvailable) {
      return NextResponse.json(
        { data: null, error: `Reviewer ${reviewerId} is not available` },
        { status: 409 }
      );
    }

    // Apply adjustedAmount before routing
    if (adjustedAmount !== undefined && adjustedAmount !== claim.claimAmount) {
      updateClaim(claimId, { claimAmount: adjustedAmount });
    }

    switch (decision) {
      case "APPROVE":
        updateClaimStatus(claimId, "APPROVED", "RESOLUTION");
        break;

      case "REJECT":
        updateClaimStatus(claimId, "REJECTED", "RESOLUTION");
        break;

      case "ESCALATE": {
        // Assign a senior reviewer (Compliance Officer)
        const seniors = getReviewersByRole("Compliance Officer");
        const senior = seniors.find((r) => r.id !== reviewerId) ?? seniors[0];
        updateClaimStatus(claimId, "ESCALATED", "HUMAN_REVIEW");
        if (senior) assignReviewer(claimId, senior.id);
        break;
      }

      case "REQUEST_MORE_INFO":
        // Status stays PENDING_REVIEW; append note
        appendReviewNotes(claimId, `[${reviewerId}] ${notes}`);
        break;
    }

    addStageEvent({
      claimId,
      stage: claim.stage,
      status: decision === "APPROVE"
        ? "APPROVED"
        : decision === "REJECT"
        ? "REJECTED"
        : decision === "ESCALATE"
        ? "ESCALATED"
        : "PENDING_REVIEW",
      actor: "HUMAN",
      notes: `${decision}: ${notes}`,
    });

    const updated = getClaimById(claimId);
    return NextResponse.json({ data: { claim: updated }, error: null });
  } catch (err) {
    console.error(`[POST /api/review/${claimId}/decision]`, err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
