import { NextResponse } from "next/server";
import { initDb, getDb } from "@/lib/db";

initDb();

// ── GET /api/review/stats ─────────────────────────────────────────────────────

export async function GET() {
  try {
    const db = getDb();

    // Today's date boundaries (ISO strings)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startISO = todayStart.toISOString();

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const endISO = endDate.toISOString();

    type CountRow = { cnt: number };
    type AvgRow = { avg_minutes: number | null };

    const total = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM claims
           WHERE createdAt >= ? AND createdAt <= ? AND deletedAt IS NULL`
        )
        .get(startISO, endISO) as CountRow
    ).cnt;

    const approved = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM claims
           WHERE status = 'APPROVED' AND resolvedAt >= ? AND resolvedAt <= ? AND deletedAt IS NULL`
        )
        .get(startISO, endISO) as CountRow
    ).cnt;

    const rejected = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM claims
           WHERE status = 'REJECTED' AND resolvedAt >= ? AND resolvedAt <= ? AND deletedAt IS NULL`
        )
        .get(startISO, endISO) as CountRow
    ).cnt;

    const escalated = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM claims
           WHERE status = 'ESCALATED' AND updatedAt >= ? AND updatedAt <= ? AND deletedAt IS NULL`
        )
        .get(startISO, endISO) as CountRow
    ).cnt;

    const pending = (
      db
        .prepare(
          `SELECT COUNT(*) as cnt FROM claims
           WHERE status IN ('PENDING_REVIEW', 'ESCALATED') AND deletedAt IS NULL`
        )
        .get() as CountRow
    ).cnt;

    // Average processing time in minutes (createdAt → resolvedAt) for today's resolved claims
    const avgRow = db
      .prepare(
        `SELECT AVG(
           (julianday(resolvedAt) - julianday(createdAt)) * 1440
         ) as avg_minutes
         FROM claims
         WHERE resolvedAt >= ? AND resolvedAt <= ?
           AND deletedAt IS NULL`
      )
      .get(startISO, endISO) as AvgRow;
    const avgProcessingTime = Math.round(avgRow.avg_minutes ?? 0);

    // Auto-approval rate: approved claims that never had a HUMAN stage event
    const approvedTodayIds = (
      db
        .prepare(
          `SELECT id FROM claims
           WHERE status = 'APPROVED' AND resolvedAt >= ? AND resolvedAt <= ? AND deletedAt IS NULL`
        )
        .all(startISO, endISO) as { id: string }[]
    ).map((r) => r.id);

    let autoApproved = 0;
    if (approvedTodayIds.length > 0) {
      const placeholders = approvedTodayIds.map(() => "?").join(",");
      const humanReviewed = (
        db
          .prepare(
            `SELECT COUNT(DISTINCT claimId) as cnt FROM stage_events
             WHERE actor = 'HUMAN' AND claimId IN (${placeholders})`
          )
          .get(...approvedTodayIds) as CountRow
      ).cnt;
      autoApproved = approvedTodayIds.length - humanReviewed;
    }

    const autoApprovalRate =
      approved > 0 ? Math.round((autoApproved / approved) * 100) : 0;

    return NextResponse.json({
      data: {
        total,
        approved,
        rejected,
        escalated,
        pending,
        avgProcessingTime,
        autoApprovalRate,
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/review/stats]", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
