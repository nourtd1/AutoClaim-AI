"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DropZone from "@/components/ui/DropZone";
import type { Claim } from "@/lib/types";

const CARD_STYLE = {
  background: "rgba(99,102,241,0.06)",
  border: "1px solid rgba(99,102,241,0.18)",
};

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
              style={
                done   ? { background: "rgba(99,102,241,0.2)", border: "2px solid rgba(99,102,241,0.5)", color: "#818CF8" } :
                active ? { background: "linear-gradient(135deg,#6366F1,#7C3AED)", border: "2px solid rgba(99,102,241,0.5)", color: "#fff", boxShadow: "0 0 16px rgba(99,102,241,0.4)" } :
                         { background: "rgba(99,102,241,0.04)", border: "2px solid rgba(99,102,241,0.12)", color: "rgba(99,102,241,0.3)" }
              }>
              {done ? "✓" : n}
            </div>
            {n < total && (
              <div className="h-px w-6 rounded-full transition-colors"
                style={{ background: done ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.08)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP_LABELS = ["Choose method", "Fill details", "Review & submit"];

interface PreviewData { claimantName: string; policyNumber: string; claimType: string; claimAmount: string; incidentDate: string; description: string; }

function PreviewCard({ data }: { data: PreviewData }) {
  const empty  = !data.claimantName && !data.policyNumber;
  const amount = parseFloat(data.claimAmount);
  return (
    <div className="rounded-xl p-4 space-y-3 transition-all duration-300" style={{ ...CARD_STYLE, opacity: empty ? 0.3 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "#E8EBF4" }}>
            {data.claimantName || <span className="italic" style={{ color: "rgba(99,102,241,0.35)" }}>Claimant name…</span>}
          </p>
          <p className="font-mono-id text-[11px] mt-0.5" style={{ color: "#4A5568" }}>
            {data.policyNumber || <span className="italic">POL-…</span>}
          </p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "rgba(129,140,248,0.7)" }}>
          {data.claimType || "TYPE"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono-id font-bold text-base tabular-nums"
          style={{ color: !isNaN(amount) && amount > 0 ? "#818CF8" : "rgba(99,102,241,0.25)" }}>
          {!isNaN(amount) && amount > 0
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
            : <span className="text-sm italic">$0</span>}
        </span>
        <span className="text-[11px]" style={{ color: "#4A5568" }}>{data.incidentDate || "date"}</span>
      </div>
      {data.description && <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "rgba(232,235,244,0.45)" }}>{data.description}</p>}
      <div className="space-y-1">
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(99,102,241,0.08)" }}>
          <div className="h-full w-1/6 rounded-full" style={{ background: "linear-gradient(90deg,#6366F1,#818CF8)" }} />
        </div>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.3)" }}>Preview — SUBMITTED · INTAKE</p>
      </div>
    </div>
  );
}

const CLAIM_TYPES = ["PROPERTY_DAMAGE", "MEDICAL", "ACCIDENT", "THEFT", "LIABILITY", "TRAVEL"] as const;
const CURRENCIES  = ["USD", "EUR", "GBP", "CAD"] as const;

const inputClass = "w-full rounded-lg text-sm px-3 py-2 focus:outline-none transition-all duration-200 input-dark";
const labelClass = "block text-[10px] uppercase tracking-widest font-semibold mb-1.5";

export default function NewClaimPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"form" | "upload">("form");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    claimantName: "", claimantEmail: "", policyNumber: "",
    claimType: "PROPERTY_DAMAGE" as typeof CLAIM_TYPES[number],
    incidentDate: "", claimAmount: "", currency: "USD" as typeof CURRENCIES[number],
    description: "", source: "FORM" as "FORM" | "EMAIL" | "PDF",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res  = await fetch("/api/claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, claimAmount: parseFloat(form.claimAmount) }) });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Submission failed");
      const claim = json.data as Claim;
      void fetch("/api/orchestrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: claim.id }) });
      router.push(`/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 topbar-bg">
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.4),rgba(124,58,237,0.3),transparent)" }} />
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: "linear-gradient(135deg,#6366F1,#7C3AED)", boxShadow: "0 0 10px rgba(99,102,241,0.4)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h4l2-6 2 12 2-8 1 4h5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </Link>
          <span style={{ color: "rgba(74,85,104,0.8)" }}>/</span>
          <Link href="/claims" className="text-xs transition-colors hover:opacity-80" style={{ color: "#4A5568" }}>Claims</Link>
          <span style={{ color: "rgba(74,85,104,0.8)" }}>/</span>
          <span className="text-xs font-semibold" style={{ color: "#E8EBF4" }}>New Claim</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 space-y-4">
          <h1 className="text-xl font-bold" style={{ color: "#E8EBF4" }}>Submit New Claim</h1>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <StepIndicator current={step} total={3} />
            <p className="text-xs font-medium" style={{ color: "rgba(129,140,248,0.7)" }}>{STEP_LABELS[step - 1]}</p>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="animate-slide-in grid sm:grid-cols-2 gap-4 max-w-xl">
            {(["form", "upload"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setStep(2); }}
                className="rounded-xl p-6 text-left space-y-2 transition-all duration-200"
                style={{
                  background: mode === m ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.05)",
                  border: `1px solid ${mode === m ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.14)"}`,
                  boxShadow: mode === m ? "0 0 20px rgba(99,102,241,0.12)" : "none",
                }}>
                <span className="text-2xl">{m === "form" ? "📝" : "📂"}</span>
                <p className="font-semibold text-sm" style={{ color: "#E8EBF4" }}>{m === "form" ? "Fill form" : "Upload file"}</p>
                <p className="text-xs" style={{ color: "#4A5568" }}>{m === "form" ? "Enter claim details manually" : "Upload PDF or email (.txt)"}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="animate-slide-in grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              {mode === "upload" ? (
                <DropZone onSuccess={(result) => {
                  void fetch("/api/orchestrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: result.claim.id }) });
                  router.push(`/claims/${result.claim.id}`);
                }} />
              ) : (
                <div className="rounded-xl p-6 space-y-5" style={CARD_STYLE}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {([
                      { k: "claimantName",  label: "Claimant Name *", type: "text",   ph: "John Smith" },
                      { k: "claimantEmail", label: "Email *",          type: "email",  ph: "john@email.com" },
                      { k: "policyNumber",  label: "Policy Number *",  type: "text",   ph: "POL-2024-001" },
                      { k: "incidentDate",  label: "Incident Date *",  type: "date",   ph: "" },
                      { k: "claimAmount",   label: "Amount *",         type: "number", ph: "5000" },
                    ] as { k: keyof typeof form; label: string; type: string; ph: string }[]).map(({ k, label, type, ph }) => (
                      <div key={k}>
                        <label className={labelClass} style={{ color: "rgba(129,140,248,0.6)" }}>{label}</label>
                        <input type={type} value={form[k] as string} onChange={set(k)} placeholder={ph}
                          className={inputClass}
                          min={type === "number" ? "0" : undefined}
                          step={type === "number" ? "0.01" : undefined} />
                      </div>
                    ))}
                    <div>
                      <label className={labelClass} style={{ color: "rgba(129,140,248,0.6)" }}>Currency</label>
                      <select value={form.currency} onChange={set("currency")} className={inputClass}>
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass} style={{ color: "rgba(129,140,248,0.6)" }}>Claim Type *</label>
                      <select value={form.claimType} onChange={set("claimType")} className={inputClass}>
                        {CLAIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: "rgba(129,140,248,0.6)" }}>
                      Description *{" "}
                      <span style={{ color: "rgba(99,102,241,0.45)" }}>(min 20 chars)</span>
                    </label>
                    <textarea value={form.description} onChange={set("description")} rows={3}
                      placeholder="Describe the incident and damages in detail…"
                      className={`${inputClass} resize-none`} />
                    <p className="mt-1 text-[10px] text-right"
                      style={{ color: form.description.length >= 20 ? "rgba(99,102,241,0.5)" : "rgba(239,68,68,0.5)" }}>
                      {form.description.length}/20 min
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)}
                  className="rounded-lg px-4 py-2 text-sm transition-all duration-200 btn-ghost">
                  ← Back
                </button>
                {mode === "form" && (
                  <button onClick={() => setStep(3)}
                    disabled={!form.claimantName || !form.policyNumber || !form.incidentDate || !form.claimAmount || form.description.length < 20}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 disabled:opacity-30 btn-primary">
                    Review →
                  </button>
                )}
              </div>
            </div>

            {mode === "form" && (
              <div className="lg:col-span-2 space-y-3">
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "rgba(129,140,248,0.5)" }}>Live Preview</p>
                <PreviewCard data={{ claimantName: form.claimantName, policyNumber: form.policyNumber, claimType: form.claimType, claimAmount: form.claimAmount, incidentDate: form.incidentDate, description: form.description }} />
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="animate-slide-in max-w-xl space-y-5">
            <div className="rounded-xl p-5 space-y-4" style={CARD_STYLE}>
              <h2 className="text-sm font-semibold" style={{ color: "#E8EBF4" }}>Review your claim</h2>
              <PreviewCard data={{ claimantName: form.claimantName, policyNumber: form.policyNumber, claimType: form.claimType, claimAmount: form.claimAmount, incidentDate: form.incidentDate, description: form.description }} />
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.12)" }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: "rgba(129,140,248,0.5)" }}>What happens next</p>
                <div className="space-y-1.5">
                  {[
                    "Claude AI extracts and validates claim data",
                    "Risk score calculated automatically",
                    "Auto-approved if risk < 40 · Human review if needed",
                  ].map((t, i) => (
                    <p key={i} className="text-xs flex items-center gap-2" style={{ color: "rgba(232,235,244,0.5)" }}>
                      <span style={{ color: "#6366F1" }}>✦</span> {t}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="rounded-lg px-4 py-2 text-sm transition-all duration-200 btn-ghost">
                ← Edit
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 disabled:opacity-40 btn-primary">
                {submitting ? "Submitting…" : "⚡ Submit Claim"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
