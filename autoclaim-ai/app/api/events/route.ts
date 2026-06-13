import { NextRequest, NextResponse } from "next/server";
import { initDb, getRecentStageEvents } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await initDb();
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10);
    const events = await getRecentStageEvents(Math.min(limit, 50));
    return NextResponse.json({ data: events, error: null });
  } catch (err) {
    console.error("[GET /api/events]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
