import { NextRequest, NextResponse } from "next/server";
import { initDb, getClaimById } from "@/lib/db";
import { orchestrator } from "@/lib/orchestrator";

initDb();

// ── POST /api/orchestrate ─────────────────────────────────────────────────────
// Starts processNewClaim() asynchronously and returns immediately.

export async function POST(req: NextRequest) {
  let claimId: string;
  try {
    const body = await req.json();
    claimId = body?.claimId;
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!claimId || typeof claimId !== "string") {
    return NextResponse.json(
      { data: null, error: "Missing required field: claimId" },
      { status: 400 }
    );
  }

  const claim = getClaimById(claimId);
  if (!claim) {
    return NextResponse.json(
      { data: null, error: `Claim not found: ${claimId}` },
      { status: 404 }
    );
  }

  // Fire-and-forget — errors logged inside orchestrator
  orchestrator.processNewClaim(claimId).catch((err) =>
    console.error(`[POST /api/orchestrate] claimId=${claimId}`, err)
  );

  const state = orchestrator.getClaimState(claimId);

  return NextResponse.json({
    data: { message: "Processing started", claimId, state },
    error: null,
  });
}

// ── GET /api/orchestrate ──────────────────────────────────────────────────────
// Triggers a poll of all stalled claims and returns processing stats.

export async function GET() {
  try {
    const stats = await orchestrator.processPendingClaims();
    return NextResponse.json({ data: stats, error: null });
  } catch (err) {
    console.error("[GET /api/orchestrate]", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
