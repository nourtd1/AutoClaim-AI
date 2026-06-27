import { NextRequest, NextResponse } from "next/server";
import { initDb, getClaimById } from "@/lib/db";
import { orchestrator } from "@/lib/orchestrator";

// Give the Claude AI extraction + validation pipeline enough time to complete.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  await initDb();
  let claimId: string;
  try { const body = await req.json(); claimId = body?.claimId; }
  catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  if (!claimId || typeof claimId !== "string") return NextResponse.json({ data: null, error: "Missing required field: claimId" }, { status: 400 });
  const claim = await getClaimById(claimId);
  if (!claim) return NextResponse.json({ data: null, error: `Claim not found: ${claimId}` }, { status: 404 });

  // Await the full pipeline so Vercel doesn't kill the Lambda before Claude finishes.
  try {
    await orchestrator.processNewClaim(claimId);
  } catch (err) {
    console.error(`[POST /api/orchestrate] claimId=${claimId}`, err);
  }

  const state = await orchestrator.getClaimState(claimId);
  return NextResponse.json({ data: { message: "Processing complete", claimId, state }, error: null });
}

export async function GET() {
  await initDb();
  try {
    const stats = await orchestrator.processPendingClaims();
    return NextResponse.json({ data: stats, error: null });
  } catch (err) {
    console.error("[GET /api/orchestrate]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
