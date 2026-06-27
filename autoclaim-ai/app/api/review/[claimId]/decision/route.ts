import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initDb, getClaimById, getReviewerById, getReviewersByRole, updateClaimStatus, appendReviewNotes, assignReviewer, addStageEvent, updateClaim, getMaestroInstanceId } from "@/lib/db";
import { maestroCompleteHumanReview } from "@/lib/maestro";

export const dynamic = "force-dynamic";

const DecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "ESCALATE", "REQUEST_MORE_INFO"]),
  reviewerId: z.string().min(1, "reviewerId is required"),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
  adjustedAmount: z.number().positive().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { claimId: string } }) {
  await initDb();
  const { claimId } = params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Validation failed", code: "VALIDATION_ERROR" }, { status: 422 });

  const { decision, reviewerId, notes, adjustedAmount } = parsed.data;

  try {
    const claim = await getClaimById(claimId);
    if (!claim) return NextResponse.json({ data: null, error: `Claim not found: ${claimId}` }, { status: 404 });

    const reviewer = await getReviewerById(reviewerId);
    if (!reviewer) return NextResponse.json({ data: null, error: `Reviewer not found: ${reviewerId}` }, { status: 404 });
    if (!reviewer.isAvailable) return NextResponse.json({ data: null, error: `Reviewer ${reviewerId} is not available` }, { status: 409 });

    if (adjustedAmount !== undefined && adjustedAmount !== claim.claimAmount)
      await updateClaim(claimId, { claimAmount: adjustedAmount });

    switch (decision) {
      case "APPROVE": await updateClaimStatus(claimId, "APPROVED", "RESOLUTION"); break;
      case "REJECT":  await updateClaimStatus(claimId, "REJECTED", "RESOLUTION"); break;
      case "ESCALATE": {
        const seniors = await getReviewersByRole("Compliance Officer");
        const senior = seniors.find(r => r.id !== reviewerId) ?? seniors[0];
        await updateClaimStatus(claimId, "ESCALATED", "HUMAN_REVIEW");
        if (senior) await assignReviewer(claimId, senior.id);
        break;
      }
      case "REQUEST_MORE_INFO":
        await appendReviewNotes(claimId, `[${reviewerId}] ${notes}`);
        break;
    }

    await addStageEvent({
      claimId, stage: claim.stage, actor: "HUMAN",
      status: decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : decision === "ESCALATE" ? "ESCALATED" : "PENDING_REVIEW",
      notes: `${decision}: ${notes}`,
    });

    const maestroInstanceId = (await getMaestroInstanceId(claimId)) ?? claimId;
    await maestroCompleteHumanReview(maestroInstanceId, decision === "REQUEST_MORE_INFO" ? "APPROVE" : decision, notes);

    const updated = await getClaimById(claimId);
    return NextResponse.json({ data: { claim: updated }, error: null });
  } catch (err) {
    console.error(`[POST /api/review/${claimId}/decision]`, err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
