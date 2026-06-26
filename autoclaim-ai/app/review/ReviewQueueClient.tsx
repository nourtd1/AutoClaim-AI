"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Claim, ValidationResult, Reviewer } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import LiveCounter from "@/components/ui/LiveCounter";
import ToastContainer, { ToastStyles } from "@/components/ui/Toast";
import type { ToastMessage } from "@/components/ui/Toast";

interface QueueItem extends Claim { assignedReviewer: Reviewer | null; }
interface QueueStats { total: number; escalated: number; pending: number; avgWaitMinutes: number; }

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
    setLoading(true); setErr(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-backdrop-in"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="rounded-xl2 p-6 w-full max-w-sm space-y-4 animate-modal-in" onClick={(e) => e.stopPropagation()}
        style={{ background: "#0D1124", border: "1px solid rgba(99,102,241,0.2)", boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.06) inset" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#E8EBF4" }}>Reassign Claim</h3>
        <div className="space-y-2">
          {reviewers.length === 0 && <p className="text-xs" style={{ color: "#4A5568" }}>No reviewers available</p>}
          {reviewers.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150"
              style={selected === r.id
                ? { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}>
                {r.name.slice(0, 1)}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#E8EBF4" }}>{r.name}</p>
                <p className="text-xs" style={{ color: "#4A5568" }}>{r.role}</p>
              </div>
              {!r.isAvailable && (
                <span className="ml-auto text-[10px] rounded-full px-1.5 py-px" style={{ color: "#F87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  Unavailable
                </span>
              )}
            </button>
          ))}
        </div>
        {err && <p className="text-xs" style={{ color: "#F87171" }}>{err}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 rounded-lg px-3 py-2 text-xs transition-colors btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={!selected || loading}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-all duration-200 btn-primary">
            {loading ? "Reassigning…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Queue item card ───────────────────────────────────────────────────────────

function QueueCard({ item, onReassign }: { item: QueueItem; onReassign: (id: string) => void }) {
  const vr = item.validationResult as ValidationResult | null;
  const riskScore = vr?.riskScore ?? null;
  const riskColor = riskScore === null ? "#4A5568"
    : riskScore >= 70 ? "#F87171"
    : riskScore >= 40 ? "#FB923C"
    : "#34D399";

  return (
    <div className="card-glow rounded-xl p-4 space-y-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "#E8EBF4" }}>{item.claimantName}</p>
          <p className="font-mono-id text-[11px]" style={{ color: "#4A5568" }}>{item.policyNumber}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={item.status} size="sm" />
          <PriorityBadge priority={item.priority} size="sm" />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "amount",  value: fmtAmount(item.claimAmount, item.currency), color: "#34D399" },
          { label: "risk",    value: riskScore !== null ? String(riskScore) : "—",  color: riskColor },
          { label: "waiting", value: waitTime(item.createdAt), color: "#8B95B0" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-mono-id font-bold text-sm tabular-nums" style={{ color }}>{value}</p>
            <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: "#3A4155" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Type + reviewer */}
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "#8B95B0" }}>{item.claimType.replace(/_/g, " ")}</span>
        {item.assignedReviewer ? (
          <span className="flex items-center gap-1.5" style={{ color: "#8B95B0" }}>
            <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#818CF8" }}>
              {item.assignedReviewer.name.slice(0, 1)}
            </span>
            {item.assignedReviewer.name.split(" ")[0]}
          </span>
        ) : (
          <span className="italic text-[11px]" style={{ color: "#3A4155" }}>Unassigned</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link href={`/claims/${item.id}#review`}
          className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-white transition-all duration-200 btn-primary">
          Review →
        </Link>
        <button onClick={() => onReassign(item.id)}
          className="rounded-lg px-3 py-2 text-xs transition-all duration-200 btn-ghost">
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
      for (const item of next) {
        if (!prevIds.current.has(item.id)) {
          addToast(`New claim requires review — ${item.claimantName}`, "warning");
        }
      }
      prevIds.current = new Set(next.map((i) => i.id));
      setItems(next);
      const pendingCount = next.length;
      document.title = pendingCount > 0 ? `(${pendingCount}) Review Queue — AutoClaim AI` : "Review Queue — AutoClaim AI";
    } catch { /**/ }
  }, [addToast]);

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
          { label: "Total Pending",  value: stats.total,          color: "#E8EBF4" },
          { label: "Escalated",      value: stats.escalated,      color: "#FB7185" },
          { label: "Pending Review", value: stats.pending,        color: "#FB923C" },
          { label: "Avg Wait (min)", value: stats.avgWaitMinutes, color: "#818CF8" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card-glow rounded-xl p-4 flex flex-col items-center gap-1">
            <LiveCounter value={value} label={label} color={color} />
          </div>
        ))}
      </div>

      {/* ESCALATED */}
      {escalated.length > 0 && (
        <section className="mb-8 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full animate-status-pulse" style={{ background: "#F43F5E" }} />
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#FB7185" }}>
              Escalated — {escalated.length}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {escalated.map((item) => <QueueCard key={item.id} item={item} onReassign={setReassignTarget} />)}
          </div>
        </section>
      )}

      {/* PENDING REVIEW */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: "#F97316" }} />
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "#FB923C" }}>
              Pending Review — {pending.length}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map((item) => <QueueCard key={item.id} item={item} onReassign={setReassignTarget} />)}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="font-semibold" style={{ color: "#E8EBF4" }}>Queue is clear</p>
          <p className="text-xs" style={{ color: "#4A5568" }}>No claims require human review right now.</p>
        </div>
      )}

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
