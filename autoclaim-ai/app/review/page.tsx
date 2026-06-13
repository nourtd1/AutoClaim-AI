import { initDb, getDb, getAvailableReviewers } from "@/lib/db";
import type { Claim, Reviewer, ValidationResult } from "@/lib/types";
import ReviewQueueClient from "./ReviewQueueClient";
import TopBar from "@/components/TopBar";

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

  const queueSubtitle = items.length === 0
    ? "Queue is clear — all caught up ✓"
    : [
        escalatedCount > 0 ? `${escalatedCount} escalated` : "",
        pendingCount > 0   ? `${pendingCount} pending`     : "",
      ].filter(Boolean).join(" · ") + " · auto-refreshes every 30s";

  return (
    <div className="min-h-screen">
      <TopBar
        title="Review Queue"
        subtitle={queueSubtitle}
        badge={items.length > 0 ? String(items.length) : undefined}
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="animate-fade-up-1">
          <ReviewQueueClient initialItems={items} availableReviewers={reviewers} />
        </div>
      </main>
    </div>
  );
}
