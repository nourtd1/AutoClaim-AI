import Link from "next/link";
import { initDb, getDb, getAvailableReviewers } from "@/lib/db";
import type { Claim, Reviewer, ValidationResult } from "@/lib/types";
import ReviewQueueClient from "./ReviewQueueClient";

initDb();

interface QueueItem extends Claim {
  assignedReviewer: Reviewer | null;
}

async function getQueueItems(): Promise<QueueItem[]> {
  const db = getDb();

  type Row = {
    id: string; policyNumber: string; claimantName: string; claimantEmail: string;
    claimType: string; incidentDate: string; claimAmount: number; currency: string;
    description: string; status: string; priority: string; stage: string; source: string;
    documents: string; extractedData: string | null; validationResult: string | null;
    reviewNotes: string | null; assignedTo: string | null; createdAt: string;
    updatedAt: string; resolvedAt: string | null;
  };

  const rows = db
    .prepare(
      `SELECT * FROM claims
       WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL
       ORDER BY CASE status WHEN 'ESCALATED' THEN 0 ELSE 1 END,
                CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                createdAt ASC`
    )
    .all() as Row[];

  const { getReviewerById } = await import("@/lib/db");

  return rows.map((row) => ({
    id: row.id,
    policyNumber: row.policyNumber,
    claimantName: row.claimantName,
    claimantEmail: row.claimantEmail,
    claimType: row.claimType,
    incidentDate: row.incidentDate,
    claimAmount: row.claimAmount,
    currency: row.currency,
    description: row.description,
    status: row.status as Claim["status"],
    priority: row.priority as Claim["priority"],
    stage: row.stage as Claim["stage"],
    source: row.source as Claim["source"],
    documents: JSON.parse(row.documents),
    extractedData: row.extractedData ? JSON.parse(row.extractedData) : null,
    validationResult: row.validationResult
      ? (JSON.parse(row.validationResult) as ValidationResult)
      : null,
    reviewNotes: row.reviewNotes,
    assignedTo: row.assignedTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    resolvedAt: row.resolvedAt,
    assignedReviewer: row.assignedTo ? getReviewerById(row.assignedTo) : null,
  }));
}

export default async function ReviewQueuePage() {
  const [items, reviewers] = await Promise.all([
    getQueueItems(),
    Promise.resolve(getAvailableReviewers()),
  ]);

  const escalatedCount = items.filter((i) => i.status === "ESCALATED").length;
  const pendingCount   = items.filter((i) => i.status === "PENDING_REVIEW").length;

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">AC</div>
              <span className="font-semibold text-slate-100 text-sm">AutoClaim <span className="text-emerald-400">AI</span></span>
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-sm text-slate-300 font-medium">Review Queue</span>
            {items.length > 0 && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </div>
          <Link href="/claims/new" className="rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-colors px-3 py-1.5 text-xs font-semibold text-white">
            + New Claim
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-100">Review Queue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {escalatedCount > 0 && <span className="text-rose-400">{escalatedCount} escalated</span>}
            {escalatedCount > 0 && pendingCount > 0 && <span className="text-slate-600"> · </span>}
            {pendingCount > 0 && <span className="text-orange-400">{pendingCount} pending review</span>}
            {items.length === 0 && "Queue is clear"}
            <span className="text-slate-600"> — auto-refreshes every 30s</span>
          </p>
        </div>

        <ReviewQueueClient initialItems={items} availableReviewers={reviewers} />
      </main>
    </div>
  );
}
