import { NextResponse } from "next/server";
import { initDb, getDb, getClaimTimeline, getReviewerById } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export async function GET() {
  await initDb();
  try {
    const db = getDb();
    const res = await db.execute({
      sql: `SELECT * FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`,
      args: [],
    });

    type R = {
      id:string; policyNumber:string; claimantName:string; claimantEmail:string; claimType:string;
      incidentDate:string; claimAmount:number; currency:string; description:string; status:string;
      priority:string; stage:string; source:string; documents:string; extractedData:string|null;
      validationResult:string|null; reviewNotes:string|null; assignedTo:string|null;
      createdAt:string; updatedAt:string; resolvedAt:string|null;
    };

    const rows = res.rows.map(r => r as unknown as R);
    rows.sort((a, b) => {
      const pd = (PRIORITY_ORDER[b.priority]??0) - (PRIORITY_ORDER[a.priority]??0);
      if (pd !== 0) return pd;
      return a.createdAt < b.createdAt ? -1 : 1;
    });

    const enriched = await Promise.all(rows.map(async row => {
      const [timeline, assignedReviewer] = await Promise.all([
        getClaimTimeline(row.id),
        row.assignedTo ? getReviewerById(row.assignedTo) : Promise.resolve(null),
      ]);
      return {
        ...row,
        claimAmount: Number(row.claimAmount),
        documents: JSON.parse(row.documents),
        extractedData: row.extractedData ? JSON.parse(row.extractedData) : null,
        validationResult: row.validationResult ? JSON.parse(row.validationResult) : null,
        timeline, assignedReviewer,
      };
    }));

    return NextResponse.json({ data: enriched, error: null });
  } catch (err) {
    console.error("[GET /api/review]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
