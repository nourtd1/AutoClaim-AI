import { NextResponse } from "next/server";
import { initDb, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await initDb();
  try {
    const db = getDb();
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const startISO = s.toISOString();
    const endDate = new Date(); endDate.setHours(23, 59, 59, 999);
    const endISO = endDate.toISOString();

    const [totalR, approvedR, rejectedR, escalatedR, pendingR, avgR] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE createdAt>=? AND createdAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] }),
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] }),
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='REJECTED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] }),
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='ESCALATED' AND updatedAt>=? AND updatedAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] }),
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`, args: [] }),
      db.execute({ sql: `SELECT AVG((julianday(resolvedAt)-julianday(createdAt))*1440) as avg_minutes FROM claims WHERE resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] }),
    ]);

    const total    = Number((totalR.rows[0] as unknown as {cnt:number}).cnt);
    const approved = Number((approvedR.rows[0] as unknown as {cnt:number}).cnt);
    const rejected = Number((rejectedR.rows[0] as unknown as {cnt:number}).cnt);
    const escalated= Number((escalatedR.rows[0] as unknown as {cnt:number}).cnt);
    const pending  = Number((pendingR.rows[0] as unknown as {cnt:number}).cnt);
    const avgProcessingTime = Math.round(Number((avgR.rows[0] as unknown as {avg_minutes:number|null}).avg_minutes ?? 0));

    const approvedIdsR = await db.execute({ sql: `SELECT id FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [startISO, endISO] });
    const approvedIds = approvedIdsR.rows.map(r => (r as unknown as {id:string}).id);

    let autoApproved = 0;
    if (approvedIds.length > 0) {
      const humanR = await db.execute({
        sql: `SELECT COUNT(DISTINCT claimId) as cnt FROM stage_events WHERE actor='HUMAN' AND claimId IN (${approvedIds.map(() => "?").join(",")})`,
        args: approvedIds,
      });
      autoApproved = approvedIds.length - Number((humanR.rows[0] as unknown as {cnt:number}).cnt);
    }

    const autoApprovalRate = approved > 0 ? Math.round((autoApproved / approved) * 100) : 0;

    return NextResponse.json({ data: { total, approved, rejected, escalated, pending, avgProcessingTime, autoApprovalRate }, error: null });
  } catch (err) {
    console.error("[GET /api/review/stats]", err);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
