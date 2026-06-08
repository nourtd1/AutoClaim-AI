"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Claim, ValidationResult, Reviewer } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import LiveCounter from "@/components/ui/LiveCounter";
import ToastContainer, { ToastStyles } from "@/components/ui/Toast";
import type { ToastMessage } from "@/components/ui/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueueItem extends Claim {
  assignedReviewer: Reviewer | null;
}

interface QueueStats {
  total: number;
  escalated: number;
  pending: number;
  avgWaitMinutes: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function avgWait(items: QueueItem[]): number {
  if (!items.length) return 0;
  const total = items.reduce((sum, c) => sum + (Date.now() - new Date(c.createdAt).getTime()), 0);
  return Math.round(total / items.length / 60_000);
}

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// ── Reassign modal ────────────────────────────────────────────────────────────

interface ReassignModalProps {
  claimId: string;
  reviewers: Reviewer[];
  onClose: () => void;
  onDone: () => void;
}

function ReassignModal({ claimId, reviewers, onClose, onDone }: ReassignModalProps) {
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!selected) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/review/${claimId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId: selected }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-xl2 border border-white/10 p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-100">Reassign Claim</h3>
        <div className="space-y-2">
          {reviewers.length === 0 && <p className="text-xs text-slate-500">No reviewers available</p>}
          {reviewers.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r.id)}
              className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected === r.id
                  ? "border-violet-600 bg-violet-950"
                  : "border-white/10 bg-slate-900 hover:border-white/20"
              }`}
            >
              <div className="h-8 w-8 rounded-full border border-violet-700 bg-violet-900 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                {r.name.slice(0, 1)}
              </div>
              <div>
                <p className="text-sm text-slate-200 font-medium">{r.name}</p>
                <p className="text-xs text-slate-500">{r.role}</p>
              </div>
              {!r.isAvailable && <span className="ml-auto text-[10px] text-red-400 border border-red-800 rounded-full px-1.5 py-px">Unavailable</span>}
            </button>
          ))}
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:border-white/20 transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={!selected || loading}
            className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 px-3 py-2 text-xs font-semibold text-white transition-colors"
          >
            {loading ? "Reassigning…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Queue item card ───────────────────────────────────────────────────────────

function QueueCard({
  item,
  onReassign,
}: {
  item: QueueItem;
  onReassign: (id: string) => void;
}) {
  const vr = item.validationResult as ValidationResult | null;
  const riskScore = vr?.riskScore ?? null;
  const riskColor =
    riskScore === null ? "text-slate-500"
    : riskScore >= 70 ? "text-red-400"
    : riskScore >= 40 ? "text-orange-400"
    : "text-emerald-400";

  return (
    <div className="glass glass-hover rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-100 text-sm truncate">{item.claimantName}</p>
          <p className="font-mono-id text-[11px] text-slate-500">{item.policyNumber}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={item.status} size="sm" />
          <PriorityBadge priority={item.priority} size="sm" />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-900 border border-white/[0.06] p-2">
          <p className="font-mono-id font-bold text-emerald-400 text-sm">{fmtAmount(item.claimAmount, item.currency)}</p>
          <p className="text-[10px] text-slate-600 uppercase tracking-wide mt-0.5">amount</p>
        </div>
        <div className="rounded-lg bg-slate-900 border border-white/[0.06] p-2">
          <p className={`font-mono-id font-bold text-sm ${riskColor}`}>
            {riskScore !== null ? riskScore : "—"}
          </p>
          <p className="text-[10px] text-slate-600 uppercase tracking-wide mt-0.5">risk</p>
        </div>
        <div className="rounded-lg bg-slate-900 border border-white/[0.06] p-2">
          <p className="font-mono-id font-bold text-slate-300 text-sm">{waitTime(item.createdAt)}</p>
          <p className="text-[10px] text-slate-600 uppercase tracking-wide mt-0.5">waiting</p>
        </div>
      </div>

      {/* Type + reviewer */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{item.claimType.replace(/_/g, " ")}</span>
        {item.assignedReviewer ? (
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-5 w-5 rounded-full bg-violet-900 border border-violet-700 flex items-center justify-center text-[10px] font-bold text-violet-300">
              {item.assignedReviewer.name.slice(0, 1)}
            </span>
            {item.assignedReviewer.name.split(" ")[0]}
          </span>
        ) : (
          <span className="text-slate-600 italic text-[11px]">Unassigned</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/claims/${item.id}#review`}
          className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors px-3 py-2 text-center text-xs font-semibold text-white"
        >
          Review →
        </Link>
        <button
          onClick={() => onReassign(item.id)}
          className="rounded-lg border border-white/10 hover:border-white/20 transition-colors px-3 py-2 text-xs text-slate-400"
        >
          Reassign
        </button>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface Props {
  initialItems: QueueItem[];
  availableReviewers: Reviewer[];
}

export default function ReviewQueueClient({ initialItems, availableReviewers }: Props) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const prevIds = useRef<Set<string>>(new Set(initialItems.map((i) => i.id)));

  const addToast = useCallback((message: string, type: ToastMessage["type"] = "info") => {
    const id = String(Date.now());
    setToasts((t) => [...t, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((m) => m.id !== id));
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/review");
      const json = await res.json();
      if (!json.data) return;
      const next = json.data as QueueItem[];
      // Detect new arrivals
      for (const item of next) {
        if (!prevIds.current.has(item.id)) {
          addToast(`New claim requires review — ${item.claimantName}`, "warning");
        }
      }
      prevIds.current = new Set(next.map((i) => i.id));
      setItems(next);
      // Update document title
      const pendingCount = next.length;
      document.title = pendingCount > 0 ? `(${pendingCount}) Review Queue — AutoClaim AI` : "Review Queue — AutoClaim AI";
    } catch {
      // silent — don't spam toasts on network hiccup
    }
  }, [addToast]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(fetchQueue, 30_000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const escalated = items.filter((i) => i.status === "ESCALATED");
  const pending   = items.filter((i) => i.status === "PENDING_REVIEW");

  const stats: QueueStats = {
    total: items.length,
    escalated: escalated.length,
    pending: pending.length,
    avgWaitMinutes: avgWait(items),
  };

  return (
    <>
      <ToastStyles />
      <ToastContainer messages={toasts} onDismiss={dismissToast} />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total Pending",  value: stats.total,            color: "text-slate-200" },
          { label: "Escalated",      value: stats.escalated,        color: "text-rose-400" },
          { label: "Pending Review", value: stats.pending,          color: "text-orange-400" },
          { label: "Avg Wait (min)", value: stats.avgWaitMinutes,   color: "text-violet-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4 flex flex-col items-center gap-1">
            <LiveCounter value={value} label={label} color={color} />
          </div>
        ))}
      </div>

      {/* ESCALATED section */}
      {escalated.length > 0 && (
        <section className="mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-status-pulse" />
            <h2 className="text-sm font-semibold text-rose-300 uppercase tracking-wide">
              Escalated — {escalated.length}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {escalated.map((item) => (
              <QueueCard key={item.id} item={item} onReassign={setReassignTarget} />
            ))}
          </div>
        </section>
      )}

      {/* PENDING REVIEW section */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500" />
            <h2 className="text-sm font-semibold text-orange-300 uppercase tracking-wide">
              Pending Review — {pending.length}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((item) => (
              <QueueCard key={item.id} item={item} onReassign={setReassignTarget} />
            ))}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-3 text-center">
          <span className="text-5xl">✅</span>
          <p className="text-slate-300 font-semibold">Queue is clear</p>
          <p className="text-xs text-slate-600">No claims require human review right now.</p>
        </div>
      )}

      {/* Reassign modal */}
      {reassignTarget && (
        <ReassignModal
          claimId={reassignTarget}
          reviewers={availableReviewers}
          onClose={() => setReassignTarget(null)}
          onDone={() => { setReassignTarget(null); void fetchQueue(); addToast("Claim reassigned", "success"); }}
        />
      )}
    </>
  );
}
