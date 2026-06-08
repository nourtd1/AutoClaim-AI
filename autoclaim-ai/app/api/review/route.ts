import { NextResponse } from "next/server";
import { initDb, getDb, getClaimTimeline, getReviewerById } from "@/lib/db";

initDb();

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

// ── GET /api/review ───────────────────────────────────────────────────────────

export async function GET() {
  try {
    type ClaimRow = {
      id: string;
      policyNumber: string;
      claimantName: string;
      claimantEmail: string;
      claimType: string;
      incidentDate: string;
      claimAmount: number;
      currency: string;
      description: string;
      status: string;
      priority: string;
      stage: string;
      source: string;
      documents: string;
      extractedData: string | null;
      validationResult: string | null;
      reviewNotes: string | null;
      assignedTo: string | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt: string | null;
    };

    const rows = getDb()
      .prepare(
        `SELECT * FROM claims
         WHERE status IN ('PENDING_REVIEW', 'ESCALATED')
           AND deletedAt IS NULL`
      )
      .all() as ClaimRow[];

    rows.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
      if (pDiff !== 0) return pDiff;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });

    const enriched = rows.map((row) => {
      const timeline = getClaimTimeline(row.id);
      const assignedReviewer = row.assignedTo ? getReviewerById(row.assignedTo) : null;
      return {
        id: row.id,
        policyNumber: row.policyNumber,
        claimantName: row.claimantName,
        claimantEmail: row.claimantEmail,
        claimType: row.claimType,
        incidentDate: row.incidentDate,
        claimAmount: row.claimAmount,
        currency: row.currency,
        description: row.description,
        status: row.status,
        priority: row.priority,
        stage: row.stage,
        source: row.source,
        documents: JSON.parse(row.documents),
        extractedData: row.extractedData ? JSON.parse(row.extractedData) : null,
        validationResult: row.validationResult ? JSON.parse(row.validationResult) : null,
        reviewNotes: row.reviewNotes,
        assignedTo: row.assignedTo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        resolvedAt: row.resolvedAt,
        timeline,
        assignedReviewer,
      };
    });

    return NextResponse.json({ data: enriched, error: null });
  } catch (err) {
    console.error("[GET /api/review]", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
