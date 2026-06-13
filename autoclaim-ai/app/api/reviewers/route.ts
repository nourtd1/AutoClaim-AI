import { NextResponse } from "next/server";
import { initDb, getAllReviewers } from "@/lib/db";

export async function GET() {
  await initDb();
  try {
    const reviewers = await getAllReviewers();
    return NextResponse.json({ data: reviewers, error: null });
  } catch (err) {
    console.error("[GET /api/reviewers]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
