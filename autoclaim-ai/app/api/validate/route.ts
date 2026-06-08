import { NextRequest, NextResponse } from "next/server";
import { validateClaim } from "@/lib/agents";
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
    const validationResult = await validateClaim(claimId);
    const claim = getClaimById(claimId);

    return NextResponse.json({ data: { claim, validationResult }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
