import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { initDb, getClaimById, getReviewerById, assignReviewer, addStageEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

const ReassignSchema = z.object({ reviewerId: z.string().min(1, "reviewerId is required") });

export async function POST(req: NextRequest, { params }: { params: { claimId: string } }) {
  await initDb();
  const { claimId } = params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = ReassignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.issues[0]?.message ?? "Validation failed", code: "VALIDATION_ERROR" }, { status: 422 });
  try {
    const claim = await getClaimById(claimId);
    if (!claim) return NextResponse.json({ data: null, error: `Claim not found: ${claimId}` }, { status: 404 });
    const reviewer = await getReviewerById(parsed.data.reviewerId);
    if (!reviewer) return NextResponse.json({ data: null, error: `Reviewer not found: ${parsed.data.reviewerId}` }, { status: 404 });
    if (!reviewer.isAvailable) return NextResponse.json({ data: null, error: `Reviewer not available` }, { status: 409 });
    await assignReviewer(claimId, parsed.data.reviewerId);
    await addStageEvent({ claimId, stage: claim.stage, status: claim.status, actor: "ROBOT", notes: `Reassigned to ${reviewer.name} (${reviewer.role})` });
    const updated = await getClaimById(claimId);
    return NextResponse.json({ data: { claim: updated }, error: null });
  } catch (err) {
    console.error(`[POST /api/review/${claimId}/reassign]`, err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
