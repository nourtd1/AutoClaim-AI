import { NextRequest, NextResponse } from "next/server";
import { initDb, getClaimById, getClaimTimeline } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  await initDb();
  try {
    const claim = await getClaimById(params.id);
    if (!claim) return NextResponse.json({ error: "Claim not found", code: "NOT_FOUND" }, { status: 404 });
    const timeline = await getClaimTimeline(params.id);
    return NextResponse.json({ data: timeline, error: null });
  } catch (err) {
    console.error("[GET /api/claims/:id/timeline]", err);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
