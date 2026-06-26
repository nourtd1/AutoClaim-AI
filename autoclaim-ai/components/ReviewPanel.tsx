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
    style: { bg:"rgba(16,185,129,0.08)", border:"rgba(16,185,129,0.2)", color:"#6EE7B7", activeBg:"rgba(16,185,129,0.25)", activeColor:"#34D399" },
  },
  {
    key: "REJECT", label: "Reject",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    style: { bg:"rgba(239,68,68,0.08)", border:"rgba(239,68,68,0.2)", color:"#FCA5A5", activeBg:"rgba(239,68,68,0.25)", activeColor:"#F87171" },
  },
  {
    key: "ESCALATE", label: "Escalate",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
    style: { bg:"rgba(236,72,153,0.08)", border:"rgba(236,72,153,0.2)", color:"#F9A8D4", activeBg:"rgba(236,72,153,0.25)", activeColor:"#F472B6" },
  },
  {
    key: "REQUEST_MORE_INFO", label: "Request Info",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>,
    style: { bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.2)", color:"#FCD34D", activeBg:"rgba(245,158,11,0.2)", activeColor:"#FDE047" },
  },
];

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(amount);
}

function ResolutionCard({ claim }: { claim: Claim }) {
  const ok = claim.status === "APPROVED";
  return (
    <div className="rounded-xl p-5 space-y-3" style={{
      background: ok ? "rgba(16,185,129,0.08)"  : "rgba(239,68,68,0.08)",
      border:     ok ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(239,68,68,0.25)",
      backdropFilter:"blur(20px)",
    }}>
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-lg"
          style={{ background: ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)", color: ok ? "#34D399" : "#F87171" }}>
          {ok ? "✓" : "✗"}
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: ok ? "#6EE7B7" : "#FCA5A5" }}>
            Claim {ok ? "Approved" : "Rejected"}
          </p>
          {claim.resolvedAt && (
            <p className="text-xs" style={{ color: "#4A5568" }}>
              {new Date(claim.resolvedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
      {claim.reviewNotes && (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "#3A4155" }}>Reviewer notes</p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: "#8B95B0" }}>{claim.reviewNotes}</p>
        </div>
      )}
    </div>
  );
}

export default function ReviewPanel({ claim, reviewer }: ReviewPanelProps) {
  const router = useRouter();
  const [decision,        setDecision]        = useState<Decision | null>(null);
  const [notes,           setNotes]           = useState("");
  const [adjustedAmount,  setAdjustedAmount]  = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);
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

  const CARD = {
    background: "rgba(99,102,241,0.05)",
    border: "1px solid rgba(99,102,241,0.15)",
  };

  const activeDecision = DECISIONS.find(d => d.key === decision);

  return (
    <div className="rounded-xl p-5 space-y-5" style={CARD}>
      {/* Reviewer */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color:"#4A5568" }}>Assigned Reviewer</p>
        {reviewer ? (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#818CF8" }}>
              {reviewer.name.slice(0,1)}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color:"#E8EBF4" }}>{reviewer.name}</p>
              <p className="text-xs" style={{ color:"#4A5568" }}>{reviewer.role}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs italic" style={{ color:"rgba(99,102,241,0.3)" }}>Unassigned</p>
        )}
      </div>

      {/* Amount */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between"
        style={{ background:"rgba(168,85,247,0.06)", border:"1px solid rgba(168,85,247,0.14)" }}>
        <span className="text-xs" style={{ color:"rgba(168,85,247,0.55)" }}>Claimed amount</span>
        <span className="font-mono-id text-sm font-bold" style={{ color:"#818CF8" }}>
          {fmtAmount(claim.claimAmount, claim.currency)}
        </span>
      </div>

      {/* Decision buttons */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color:"#4A5568" }}>Decision</p>
        <div className="grid grid-cols-2 gap-2">
          {DECISIONS.map(d => {
            const active = decision === d.key;
            return (
              <button key={d.key} type="button" onClick={() => setDecision(active ? null : d.key)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={{
                  background: active ? d.style.activeBg : d.style.bg,
                  border: `1px solid ${active ? d.style.activeColor : d.style.border}`,
                  color: active ? d.style.activeColor : d.style.color,
                  boxShadow: active ? `0 0 12px ${d.style.activeBg}` : "none",
                }}>
                {d.icon} {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block" style={{ color:"#4A5568" }}>
          Notes <span style={{ color:"#EC4899" }}>*</span>
        </label>
        <textarea ref={notesRef} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Explain your decision (min. 10 characters)…" rows={3}
          className="input-dark w-full rounded-xl text-sm px-3 py-2 resize-none" />
        <p className="mt-1 text-[10px] text-right transition-colors"
          style={{ color: notes.trim().length >= 10 ? "#4A5568" : "rgba(239,68,68,0.5)" }}>
          {notes.trim().length}/10 min
        </p>
      </div>

      {/* Adjusted amount */}
      <div>
        <label className="text-[10px] uppercase tracking-widest font-semibold mb-1.5 block" style={{ color:"#4A5568" }}>
          Adjusted Amount <span style={{ color:"rgba(99,102,241,0.3)" }}>(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color:"#4A5568" }}>$</span>
          <input type="text" value={adjustedAmount} onChange={e => setAdjustedAmount(e.target.value)}
            placeholder={String(claim.claimAmount)}
            className="input-dark w-full text-sm pl-6 pr-3 py-2" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button type="button" onClick={submit} disabled={!canSubmit}
        className="w-full rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        style={canSubmit && activeDecision ? {
          background:`linear-gradient(135deg,${activeDecision.style.activeBg},${activeDecision.style.bg})`,
          border:`1px solid ${activeDecision.style.activeColor}`,
          color: activeDecision.style.activeColor,
          boxShadow:`0 0 16px ${activeDecision.style.activeBg}`,
        } : {
          background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.14)", color: "rgba(129,140,248,0.4)",
        }}>
        {submitting ? "Submitting…" : decision ? `Submit — ${DECISIONS.find(d=>d.key===decision)?.label}` : "Select a decision"}
      </button>

      {!reviewer && (
        <p className="text-[10px] text-center" style={{ color:"#FCD34D" }}>⚠ No reviewer assigned — submission blocked</p>
      )}
    </div>
  );
}
