import { NextRequest, NextResponse } from "next/server";
import { initDb, getClaimById, getClaimTimeline } from "@/lib/db";

initDb();

type Params = { params: { id: string } };

// ── GET /api/claims/[id]/timeline ─────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const claim = getClaimById(params.id);
    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const timeline = getClaimTimeline(params.id);
    return NextResponse.json({ data: timeline, error: null });
  } catch (err) {
    console.error("[GET /api/claims/:id/timeline]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
