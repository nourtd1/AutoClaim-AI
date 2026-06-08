import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  getClaimById,
  updateClaim,
  softDeleteClaim,
  getClaimTimeline,
} from "@/lib/db";
import { UpdateClaimSchema } from "@/lib/validation";

initDb();

type Params = { params: { id: string } };

function notFound() {
  return NextResponse.json(
    { error: "Claim not found", code: "NOT_FOUND" },
    { status: 404 }
  );
}

// ── GET /api/claims/[id] ──────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const claim = getClaimById(params.id);
    if (!claim) return notFound();

    const timeline = getClaimTimeline(params.id);
    return NextResponse.json({ data: { ...claim, timeline }, error: null });
  } catch (err) {
    console.error("[GET /api/claims/:id]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ── PATCH /api/claims/[id] ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const existing = getClaimById(params.id);
  if (!existing) return notFound();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const parsed = UpdateClaimSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Validation failed";
    return NextResponse.json(
      { error: msg, code: "VALIDATION_ERROR" },
      { status: 422 }
    );
  }

  try {
    // Strip keys whose value is undefined so exactOptionalPropertyTypes is satisfied
    const patch = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    ) as Parameters<typeof updateClaim>[1];
    const updated = updateClaim(params.id, patch);
    return NextResponse.json({ data: updated, error: null });
  } catch (err) {
    console.error("[PATCH /api/claims/:id]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// ── DELETE /api/claims/[id] ───────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const existing = getClaimById(params.id);
    if (!existing) return notFound();

    softDeleteClaim(params.id);
    return NextResponse.json({ data: { id: params.id, deleted: true }, error: null });
  } catch (err) {
    console.error("[DELETE /api/claims/:id]", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
