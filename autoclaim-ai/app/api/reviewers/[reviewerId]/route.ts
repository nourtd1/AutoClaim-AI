import { NextRequest, NextResponse } from "next/server";
import { initDb, getReviewerById, setReviewerAvailability, getClaimsByReviewer } from "@/lib/db";

export const dynamic = "force-dynamic";

initDb();

// GET /api/reviewers/[reviewerId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { reviewerId: string } }
) {
  try {
    const reviewer = getReviewerById(params.reviewerId);
    if (!reviewer) return NextResponse.json({ data: null, error: "Reviewer not found" }, { status: 404 });
    const claims = getClaimsByReviewer(params.reviewerId);
    return NextResponse.json({ data: { reviewer, claims }, error: null });
  } catch (err) {
    console.error("[GET /api/reviewers/:id]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/reviewers/[reviewerId] — toggle isAvailable
export async function PATCH(
  req: NextRequest,
  { params }: { params: { reviewerId: string } }
) {
  let body: { isAvailable?: boolean };
  try { body = await req.json(); } catch { body = {}; }

  if (typeof body.isAvailable !== "boolean") {
    return NextResponse.json({ data: null, error: "isAvailable (boolean) required" }, { status: 400 });
  }

  try {
    const reviewer = setReviewerAvailability(params.reviewerId, body.isAvailable);
    return NextResponse.json({ data: reviewer, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: msg }, { status: msg.includes("not found") ? 404 : 500 });
  }
}
