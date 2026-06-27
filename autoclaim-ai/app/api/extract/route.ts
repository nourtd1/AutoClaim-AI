import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { extractClaimData, validateClaim } from "@/lib/agents";
import { getClaimById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await initDb();
  let claimId: string;
  try { const body = await req.json(); claimId = body?.claimId; }
  catch { return NextResponse.json({ data: null, error: "Invalid JSON body" }, { status: 400 }); }
  if (!claimId || typeof claimId !== "string") return NextResponse.json({ data: null, error: "Missing required field: claimId" }, { status: 400 });
  try {
    const extractedData = await extractClaimData(claimId);
    const claim = await getClaimById(claimId);
    validateClaim(claimId).catch(err => console.error(`[validate] claimId=${claimId}`, err));
    return NextResponse.json({ data: { claim, extractedData }, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ data: null, error: message }, { status: message.includes("not found") ? 404 : 500 });
  }
}
