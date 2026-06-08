import { NextResponse } from "next/server";
import { initDb, getAllReviewers } from "@/lib/db";

initDb();

// GET /api/reviewers
export async function GET() {
  try {
    const reviewers = getAllReviewers();
    return NextResponse.json({ data: reviewers, error: null });
  } catch (err) {
    console.error("[GET /api/reviewers]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
