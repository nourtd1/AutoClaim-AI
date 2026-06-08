import { NextRequest, NextResponse } from "next/server";
import { extractClaimData, validateClaim } from "@/lib/agents";
import { getClaimById } from "@/lib/db";

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

  try {
    const extractedData = await extractClaimData(claimId);
    const claim = getClaimById(claimId);

    // Fire-and-forget validation (stub); don't await so the response is immediate
    validateClaim(claimId).catch((err) =>
      console.error(`[validate] claimId=${claimId}`, err)
    );

    return NextResponse.json({ data: { claim, extractedData }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
