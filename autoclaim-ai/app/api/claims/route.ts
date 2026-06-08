import { NextRequest, NextResponse } from "next/server";
import { initDb, getAllClaims, createClaim, addStageEvent } from "@/lib/db";
import { CreateClaimSchema, ClaimFilterSchema } from "@/lib/validation";
import type { ClaimStatus, ClaimPriority } from "@/lib/types";

initDb();

function zodError(msg: string) {
  return NextResponse.json(
    { error: msg, code: "VALIDATION_ERROR" },
    { status: 422 }
  );
}

// ── GET /api/claims ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const raw = {
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      source: searchParams.get("source") ?? undefined,
    };

    const parsed = ClaimFilterSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid filter parameters";
      return NextResponse.json(
        { error: msg, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const filters: Parameters<typeof getAllClaims>[0] = {};
    if (parsed.data.status)   filters.status   = parsed.data.status as ClaimStatus;
    if (parsed.data.priority) filters.priority = parsed.data.priority as ClaimPriority;
    if (parsed.data.source)   filters.source   = parsed.data.source;
    const claims = getAllClaims(filters);

    return NextResponse.json({ data: claims, error: null });
  } catch (err) {
    console.error("[GET /api/claims]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ── POST /api/claims ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const parsed = CreateClaimSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation failed";
    return zodError(msg);
  }

  try {
    const input = parsed.data;

    const claim = createClaim({
      ...input,
      status: "SUBMITTED",
      priority: "MEDIUM",
      stage: "INTAKE",
      documents: [],
      extractedData: null,
      validationResult: null,
      reviewNotes: null,
      assignedTo: null,
      resolvedAt: null,
    });

    addStageEvent({
      claimId: claim.id,
      stage: "INTAKE",
      status: "SUBMITTED",
      actor: "ROBOT",
      notes: `Claim received via ${input.source}`,
    });

    return NextResponse.json({ data: claim, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/claims]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
