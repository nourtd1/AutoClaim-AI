"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Claim, Reviewer } from "@/lib/types";

interface ReviewPanelProps {
  claim: Claim;
  reviewer: Reviewer | null;
}

type Decision = "APPROVE" | "REJECT" | "ESCALATE" | "REQUEST_MORE_INFO";

const DECISION_CONFIG: Record<Decision, { label: string; color: string; icon: string }> = {
  APPROVE:           { label: "Approve",      color: "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600",    icon: "✓" },
  REJECT:            { label: "Reject",        color: "bg-red-700    hover:bg-red-600     text-white border-red-700",         icon: "✗" },
  ESCALATE:          { label: "Escalate",      color: "bg-rose-900   hover:bg-rose-800    text-rose-200 border-rose-700",     icon: "↑" },
  REQUEST_MORE_INFO: { label: "Request Info",  color: "bg-amber-900  hover:bg-amber-800   text-amber-200 border-amber-700",   icon: "?" },
};

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// ── Resolved state display ────────────────────────────────────────────────────

function ResolutionCard({ claim }: { claim: Claim }) {
  const isApproved = claim.status === "APPROVED";
  const cfg = {
    bg: isApproved ? "bg-emerald-950 border-emerald-800" : "bg-red-950 border-red-800",
    title: isApproved ? "text-emerald-300" : "text-red-300",
    icon: isApproved ? "✓" : "✗",
    label: isApproved ? "Approved" : "Rejected",
  };

  return (
    <div className={`rounded-xl border p-5 space-y-3 ${cfg.bg}`}>
      <div className="flex items-center gap-2">
        <span className={`text-2xl font-bold ${cfg.title}`}>{cfg.icon}</span>
        <div>
          <p className={`text-sm font-bold ${cfg.title}`}>Claim {cfg.label}</p>
          {claim.resolvedAt && (
            <p className="text-xs text-slate-500">
              {new Date(claim.resolvedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
      {claim.reviewNotes && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Reviewer notes</p>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{claim.reviewNotes}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewPanel({ claim, reviewer }: ReviewPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState("");
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  if (claim.status === "APPROVED" || claim.status === "REJECTED") {
    return <ResolutionCard claim={claim} />;
  }

  const canSubmit =
    decision !== null &&
    notes.trim().length >= 10 &&
    !submitting;

  const submit = async () => {
    if (!decision || !reviewer) return;
    setError(null);
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        decision,
        reviewerId: reviewer.id,
        notes: notes.trim(),
      };
      if (adjustedAmount.trim()) {
        const amt = parseFloat(adjustedAmount.replace(/[^0-9.]/g, ""));
        if (!isNaN(amt) && amt > 0) body.adjustedAmount = amt;
      }

      const res = await fetch(`/api/review/${claim.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Request failed (${res.status})`);

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-xl border border-white/[0.08] p-5 space-y-5">
      {/* Reviewer info */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Assigned Reviewer</p>
        {reviewer ? (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-violet-900 border border-violet-700 flex items-center justify-center text-sm">
              {reviewer.name.slice(0, 1)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{reviewer.name}</p>
              <p className="text-xs text-slate-500">{reviewer.role}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">Unassigned</p>
        )}
      </div>

      {/* Original amount reference */}
      <div className="rounded-lg bg-slate-900 border border-white/[0.06] px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">Claimed amount</span>
        <span className="font-mono-id text-sm font-bold text-emerald-400">
          {fmtAmount(claim.claimAmount, claim.currency)}
        </span>
      </div>

      {/* Decision buttons */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Decision</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(DECISION_CONFIG) as [Decision, typeof DECISION_CONFIG[Decision]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDecision(decision === key ? null : key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                decision === key
                  ? cfg.color + " ring-1 ring-white/20"
                  : "border-white/10 bg-slate-900 text-slate-400 hover:border-white/20"
              }`}
            >
              <span>{cfg.icon}</span> {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
          Notes <span className="text-rose-500">*</span>
        </label>
        <textarea
          ref={notesRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Explain your decision (min. 10 characters)…"
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-slate-900 text-sm text-slate-200 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
        />
        <p className={`mt-1 text-[10px] text-right transition-colors ${notes.trim().length >= 10 ? "text-slate-600" : "text-slate-500"}`}>
          {notes.trim().length}/10 min
        </p>
      </div>

      {/* Adjusted amount (optional) */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1.5 block">
          Adjusted Amount <span className="text-slate-600">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
          <input
            type="text"
            value={adjustedAmount}
            onChange={(e) => setAdjustedAmount(e.target.value)}
            placeholder={String(claim.claimAmount)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 text-sm text-slate-200 placeholder:text-slate-600 pl-6 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-4 py-2.5 text-sm font-semibold text-white"
      >
        {submitting ? "Submitting…" : decision ? `Submit — ${DECISION_CONFIG[decision].label}` : "Select a decision"}
      </button>

      {!reviewer && (
        <p className="text-[10px] text-amber-500 text-center">⚠ No reviewer assigned — submission blocked</p>
      )}
    </div>
  );
}
