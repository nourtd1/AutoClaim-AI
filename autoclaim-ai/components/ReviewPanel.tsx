"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Claim, Reviewer } from "@/lib/types";

interface ReviewPanelProps { claim: Claim; reviewer: Reviewer | null; }
type Decision = "APPROVE" | "REJECT" | "ESCALATE" | "REQUEST_MORE_INFO";

const DECISIONS: { key: Decision; label: string; icon: React.ReactNode; style: { bg:string; border:string; color:string; activeBg:string; activeColor:string } }[] = [
  {
    key: "APPROVE", label: "Approve",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
    style: { bg:"oklch(0.72 0.18 142 / 0.08)", border:"oklch(0.72 0.18 142 / 0.22)", color:"oklch(0.82 0.16 142 / 0.80)", activeBg:"oklch(0.72 0.18 142 / 0.20)", activeColor:"oklch(0.82 0.16 142)" },
  },
  {
    key: "REJECT", label: "Reject",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    style: { bg:"oklch(0.68 0.22 22 / 0.08)", border:"oklch(0.68 0.22 22 / 0.22)", color:"oklch(0.76 0.18 22 / 0.80)", activeBg:"oklch(0.68 0.22 22 / 0.22)", activeColor:"oklch(0.76 0.18 22)" },
  },
  {
    key: "ESCALATE", label: "Escalate",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
    style: { bg:"oklch(0.70 0.19 12 / 0.08)", border:"oklch(0.70 0.19 12 / 0.22)", color:"oklch(0.78 0.15 12 / 0.80)", activeBg:"oklch(0.70 0.19 12 / 0.22)", activeColor:"oklch(0.78 0.15 12)" },
  },
  {
    key: "REQUEST_MORE_INFO", label: "Request Info",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>,
    style: { bg:"oklch(0.80 0.13 78 / 0.08)", border:"oklch(0.80 0.13 78 / 0.22)", color:"oklch(0.88 0.11 78 / 0.80)", activeBg:"oklch(0.80 0.13 78 / 0.20)", activeColor:"oklch(0.88 0.11 78)" },
  },
];

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(amount);
}

function ResolutionCard({ claim }: { claim: Claim }) {
  const ok = claim.status === "APPROVED";
  return (
    <div className="rounded-xl p-5 space-y-3" style={{
      background: ok ? "oklch(0.72 0.18 142 / 0.07)" : "oklch(0.68 0.22 22 / 0.07)",
      border: ok ? "1px solid oklch(0.72 0.18 142 / 0.22)" : "1px solid oklch(0.68 0.22 22 / 0.22)",
    }}>
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-lg"
          style={{
            background: ok ? "oklch(0.72 0.18 142 / 0.18)" : "oklch(0.68 0.22 22 / 0.18)",
            color: ok ? "oklch(0.82 0.16 142)" : "oklch(0.76 0.18 22)",
          }}>
          {ok ? "✓" : "✗"}
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: ok ? "oklch(0.82 0.16 142)" : "oklch(0.76 0.18 22)" }}>
            Claim {ok ? "Approved" : "Rejected"}
          </p>
          {claim.resolvedAt && (
            <p className="text-xs" style={{ color: "oklch(0.38 0.005 140)" }}>
              {new Date(claim.resolvedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
      {claim.reviewNotes && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "oklch(0.35 0.005 140)" }}>
            Reviewer notes
          </p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.55 0.008 140)" }}>
            {claim.reviewNotes}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReviewPanel({ claim, reviewer }: ReviewPanelProps) {
  const router = useRouter();
  const [decision,       setDecision]       = useState<Decision | null>(null);
  const [notes,          setNotes]          = useState("");
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  if (claim.status === "APPROVED" || claim.status === "REJECTED") return <ResolutionCard claim={claim} />;

  const canSubmit = decision !== null && notes.trim().length >= 10 && !submitting;

  const submit = async () => {
    if (!decision || !reviewer) return;
    setError(null); setSubmitting(true);
    try {
      const body: Record<string, unknown> = { decision, reviewerId: reviewer.id, notes: notes.trim() };
      if (adjustedAmount.trim()) {
        const amt = parseFloat(adjustedAmount.replace(/[^0-9.]/g,""));
        if (!isNaN(amt) && amt > 0) body.adjustedAmount = amt;
      }
      const res  = await fetch(`/api/review/${claim.id}/decision`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Request failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setSubmitting(false); }
  };

  const activeDecision = DECISIONS.find(d => d.key === decision);

  return (
    <div className="rounded-xl p-5 space-y-5"
      style={{
        background: "oklch(0.72 0.18 142 / 0.04)",
        border: "1px solid oklch(0.72 0.18 142 / 0.14)",
      }}>
      {/* Reviewer */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color: "oklch(0.35 0.005 140)" }}>
          Assigned Reviewer
        </p>
        {reviewer ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm"
              style={{
                background: "oklch(0.72 0.18 142 / 0.14)",
                border: "1px solid oklch(0.72 0.18 142 / 0.28)",
                color: "oklch(0.82 0.16 142)",
              }}>
              {reviewer.name.slice(0,1)}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "oklch(0.93 0.005 140)" }}>{reviewer.name}</p>
              <p className="text-xs" style={{ color: "oklch(0.38 0.005 140)" }}>{reviewer.role}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs italic" style={{ color: "oklch(0.72 0.18 142 / 0.35)" }}>Unassigned</p>
        )}
      </div>

      {/* Amount */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between"
        style={{
          background: "oklch(1.00 0.000 0 / 0.03)",
          border: "1px solid oklch(1.00 0.000 0 / 0.09)",
        }}>
        <span className="text-xs" style={{ color: "oklch(0.42 0.006 140)" }}>Claimed amount</span>
        <span className="font-mono-id text-sm font-bold" style={{ color: "oklch(0.82 0.16 142)" }}>
          {fmtAmount(claim.claimAmount, claim.currency)}
        </span>
      </div>

      {/* Decision buttons */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color: "oklch(0.35 0.005 140)" }}>
          Decision
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DECISIONS.map(d => {
            const active = decision === d.key;
            return (
              <button key={d.key} type="button" onClick={() => setDecision(active ? null : d.key)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-180"
                style={{
                  background: active ? d.style.activeBg : d.style.bg,
                  border: `1px solid ${active ? d.style.activeColor : d.style.border}`,
                  color: active ? d.style.activeColor : d.style.color,
                  boxShadow: active ? `0 0 10px ${d.style.activeBg}` : "none",
                }}>
                {d.icon} {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block"
          style={{ color: "oklch(0.35 0.005 140)" }}>
          Notes <span style={{ color: "oklch(0.68 0.22 22)" }}>*</span>
        </label>
        <textarea ref={notesRef} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Explain your decision (min. 10 characters)…" rows={3}
          className="input-dark w-full rounded-lg text-sm px-3 py-2 resize-none" />
        <p className="mt-1 text-[10px] text-right transition-colors"
          style={{ color: notes.trim().length >= 10 ? "oklch(0.38 0.005 140)" : "oklch(0.68 0.22 22 / 0.55)" }}>
          {notes.trim().length}/10 min
        </p>
      </div>

      {/* Adjusted amount */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block"
          style={{ color: "oklch(0.35 0.005 140)" }}>
          Adjusted Amount <span style={{ color: "oklch(0.72 0.18 142 / 0.35)" }}>(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "oklch(0.38 0.005 140)" }}>$</span>
          <input type="text" value={adjustedAmount} onChange={e => setAdjustedAmount(e.target.value)}
            placeholder={String(claim.claimAmount)}
            className="input-dark w-full text-sm pl-6 pr-3 py-2" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-3 py-2.5 text-xs"
          style={{
            background: "oklch(0.68 0.22 22 / 0.09)",
            border: "1px solid oklch(0.68 0.22 22 / 0.25)",
            color: "oklch(0.76 0.18 22)",
          }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button type="button" onClick={submit} disabled={!canSubmit}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-180 disabled:opacity-30 disabled:cursor-not-allowed"
        style={canSubmit && activeDecision ? {
          background: activeDecision.style.activeBg,
          border: `1px solid ${activeDecision.style.activeColor}`,
          color: activeDecision.style.activeColor,
          boxShadow: `0 0 14px ${activeDecision.style.activeBg}`,
        } : {
          background: "oklch(0.72 0.18 142 / 0.05)",
          border: "1px solid oklch(0.72 0.18 142 / 0.12)",
          color: "oklch(0.72 0.18 142 / 0.35)",
        }}>
        {submitting ? "Submitting…" : decision ? `Submit — ${DECISIONS.find(d=>d.key===decision)?.label}` : "Select a decision"}
      </button>

      {!reviewer && (
        <p className="text-[10px] text-center" style={{ color: "oklch(0.80 0.13 78)" }}>
          ⚠ No reviewer assigned — submission blocked
        </p>
      )}
    </div>
  );
}
