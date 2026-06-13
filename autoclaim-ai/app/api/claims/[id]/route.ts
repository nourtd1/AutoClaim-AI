import { NextRequest, NextResponse } from "next/server";
import { initDb, getClaimById, updateClaim, softDeleteClaim, getClaimTimeline } from "@/lib/db";
import { UpdateClaimSchema } from "@/lib/validation";

type Params = { params: { id: string } };
const notFound = () => NextResponse.json({ error: "Claim not found", code: "NOT_FOUND" }, { status: 404 });

export async function GET(_req: NextRequest, { params }: Params) {
  await initDb();
  try {
    const claim = await getClaimById(params.id);
    if (!claim) return notFound();
    const timeline = await getClaimTimeline(params.id);
    return NextResponse.json({ data: { ...claim, timeline }, error: null });
  } catch (err) {
    console.error("[GET /api/claims/:id]", err);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  await initDb();
  const existing = await getClaimById(params.id);
  if (!existing) return notFound();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 }); }
  const parsed = UpdateClaimSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed", code: "VALIDATION_ERROR" }, { status: 422 });
  try {
    const patch = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as Parameters<typeof updateClaim>[1];
    const updated = await updateClaim(params.id, patch);
    return NextResponse.json({ data: updated, error: null });
  } catch (err) {
    console.error("[PATCH /api/claims/:id]", err);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await initDb();
  try {
    const existing = await getClaimById(params.id);
    if (!existing) return notFound();
    await softDeleteClaim(params.id);
    return NextResponse.json({ data: { id: params.id, deleted: true }, error: null });
  } catch (err) {
    console.error("[DELETE /api/claims/:id]", err);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
