import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  initDb,
  getClaimById,
  getReviewerById,
  assignReviewer,
  addStageEvent,
} from "@/lib/db";

initDb();

const ReassignSchema = z.object({
  reviewerId: z.string().min(1, "reviewerId is required"),
});

// ── POST /api/review/[claimId]/reassign ───────────────────────────────────────

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

  const parsed = ReassignSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation failed";
    return NextResponse.json(
      { data: null, error: msg, code: "VALIDATION_ERROR" },
      { status: 422 }
    );
  }

  const { reviewerId } = parsed.data;

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

    assignReviewer(claimId, reviewerId);

    addStageEvent({
      claimId,
      stage: claim.stage,
      status: claim.status,
      actor: "ROBOT",
      notes: `Reassigned to reviewer ${reviewer.name} (${reviewer.role})`,
    });

    const updated = getClaimById(claimId);
    return NextResponse.json({ data: { claim: updated }, error: null });
  } catch (err) {
    console.error(`[POST /api/review/${claimId}/reassign]`, err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
