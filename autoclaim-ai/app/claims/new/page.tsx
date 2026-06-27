"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import DropZone from "@/components/ui/DropZone";
import type { Claim } from "@/lib/types";

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2" role="list" aria-label="Form steps">
      {Array.from({ length: total }, (_, i) => {
        const n      = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2" role="listitem">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
              aria-current={active ? "step" : undefined}
              aria-label={`Step ${n}${done ? " (complete)" : active ? " (current)" : ""}`}
              style={
                done
                  ? { background: "var(--green-dim)", border: "2px solid var(--green-border)", color: "var(--green-bright)" }
                  : active
                  ? { background: "var(--green)", border: "2px solid var(--green-border)", color: "oklch(0.09 0 0)", boxShadow: "0 0 16px var(--green-glow)" }
                  : { background: "oklch(1 0 0 / 0.03)", border: "2px solid var(--border)", color: "var(--text-4)" }
              }
            >
              {done ? "✓" : n}
            </div>
            {n < total && (
              <div className="h-px w-6 rounded-full transition-colors"
                style={{ background: done ? "var(--green-border)" : "var(--border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP_LABELS = ["Choose method", "Fill details", "Review & submit"];

interface PreviewData {
  claimantName: string; policyNumber: string; claimType: string;
  claimAmount: string; incidentDate: string; description: string;
}

function PreviewCard({ data }: { data: PreviewData }) {
  const empty  = !data.claimantName && !data.policyNumber;
  const amount = parseFloat(data.claimAmount);
  return (
    <div className="card rounded-xl p-4 space-y-3 transition-all duration-300" style={{ opacity: empty ? 0.35 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {data.claimantName || <span className="italic" style={{ color: "var(--text-4)" }}>Claimant name…</span>}
          </p>
          <p className="font-mono-id text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
            {data.policyNumber || <span className="italic">POL-…</span>}
          </p>
        </div>
        <span className="text-[10px] rounded-full px-2 py-0.5 shrink-0"
          style={{ background: "var(--azure-dim)", border: "1px solid var(--azure-border)", color: "var(--azure-bright)" }}>
          {data.claimType || "TYPE"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono-id font-bold text-base tabular-nums"
          style={{ color: !isNaN(amount) && amount > 0 ? "var(--green-bright)" : "var(--text-4)" }}>
          {!isNaN(amount) && amount > 0
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
            : <span className="text-sm italic">$0</span>}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{data.incidentDate || "date"}</span>
      </div>
      {data.description && (
        <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--text-2)" }}>{data.description}</p>
      )}
      <div className="space-y-1">
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--border-mid)" }}>
          <div className="h-full w-1/6 rounded-full" style={{ background: "var(--green)" }} />
        </div>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-4)" }}>Preview — SUBMITTED · INTAKE</p>
      </div>
    </div>
  );
}

const CLAIM_TYPES = ["PROPERTY_DAMAGE", "MEDICAL", "ACCIDENT", "THEFT", "LIABILITY", "TRAVEL"] as const;
const CURRENCIES  = ["USD", "EUR", "GBP", "CAD"] as const;

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

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res  = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, claimAmount: parseFloat(form.claimAmount) }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Submission failed");
      const claim = json.data as Claim;
      router.push(`/claims/${claim.id}`);
      void fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar title="New Claim" subtitle="Submit a new insurance claim" />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <StepIndicator current={step} total={3} />
            <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>{STEP_LABELS[step - 1]}</p>
          </div>
        </div>

        {/* Step 1 — choose method */}
        {step === 1 && (
          <div className="animate-slide-in grid sm:grid-cols-2 gap-4 max-w-xl">
            {(["form", "upload"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setStep(2); }}
                className="rounded-xl p-6 text-left space-y-2 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: mode === m ? "var(--green-dim)" : "oklch(1 0 0 / 0.03)",
                  border: `1px solid ${mode === m ? "var(--green-border)" : "var(--border)"}`,
                  boxShadow: mode === m ? "0 0 20px var(--green-glow)" : "none",
                  outlineColor: "var(--green)",
                }}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ background: mode === m ? "var(--green-dim)" : "var(--surface-2)", border: "1px solid var(--border-mid)" }}>
                  {m === "form"
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--green)" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  }
                </div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  {m === "form" ? "Fill form" : "Upload file"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  {m === "form" ? "Enter claim details manually" : "Upload PDF or email (.txt)"}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — details */}
        {step === 2 && (
          <div className="animate-slide-in grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              {mode === "upload" ? (
                <DropZone onSuccess={(result) => {
                  router.push(`/claims/${result.claim.id}`);
                }} />
              ) : (
                <div className="card rounded-xl p-6 space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {([
                      { k: "claimantName",  label: "Claimant Name", required: true,  type: "text",   ph: "John Smith" },
                      { k: "claimantEmail", label: "Email",         required: true,  type: "email",  ph: "john@email.com" },
                      { k: "policyNumber",  label: "Policy Number", required: true,  type: "text",   ph: "POL-2024-001" },
                      { k: "incidentDate",  label: "Incident Date", required: true,  type: "date",   ph: "" },
                      { k: "claimAmount",   label: "Amount",        required: true,  type: "number", ph: "5000" },
                    ] as { k: keyof typeof form; label: string; required: boolean; type: string; ph: string }[]).map(({ k, label, required, type, ph }) => (
                      <div key={k}>
                        <label htmlFor={`field-${k}`} className={labelClass} style={{ color: "var(--text-3)" }}>
                          {label}{required && <span className="ml-0.5" style={{ color: "var(--state-rejected)" }} aria-hidden>*</span>}
                        </label>
                        <input
                          id={`field-${k}`}
                          type={type}
                          value={form[k] as string}
                          onChange={set(k)}
                          placeholder={ph}
                          required={required}
                          min={type === "number" ? "0" : undefined}
                          step={type === "number" ? "0.01" : undefined}
                          className="input-dark w-full rounded-lg text-sm px-3 py-2 focus:outline-none transition-all duration-200"
                        />
                      </div>
                    ))}
                    <div>
                      <label htmlFor="field-currency" className={labelClass} style={{ color: "var(--text-3)" }}>Currency</label>
                      <select id="field-currency" value={form.currency} onChange={set("currency")}
                        className="select-dark w-full rounded-lg text-sm px-3 py-2">
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="field-claimType" className={labelClass} style={{ color: "var(--text-3)" }}>
                        Claim Type<span className="ml-0.5" style={{ color: "var(--state-rejected)" }} aria-hidden>*</span>
                      </label>
                      <select id="field-claimType" value={form.claimType} onChange={set("claimType")}
                        className="select-dark w-full rounded-lg text-sm px-3 py-2">
                        {CLAIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="field-description" className={labelClass} style={{ color: "var(--text-3)" }}>
                      Description<span className="ml-0.5" style={{ color: "var(--state-rejected)" }} aria-hidden>*</span>
                      <span className="ml-1.5 normal-case tracking-normal font-normal" style={{ color: "var(--text-4)" }}>(min 20 chars)</span>
                    </label>
                    <textarea
                      id="field-description"
                      value={form.description}
                      onChange={set("description")}
                      rows={3}
                      placeholder="Describe the incident and damages in detail…"
                      className="input-dark w-full rounded-lg text-sm px-3 py-2 focus:outline-none transition-all duration-200 resize-none"
                    />
                    <p className="mt-1 text-[10px] text-right"
                      style={{ color: form.description.length >= 20 ? "var(--text-4)" : "var(--state-rejected)" }}>
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
                  <button
                    onClick={() => setStep(3)}
                    disabled={!form.claimantName || !form.policyNumber || !form.incidentDate || !form.claimAmount || form.description.length < 20}
                    className="flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 disabled:opacity-30 btn-primary">
                    Review →
                  </button>
                )}
              </div>
            </div>

            {mode === "form" && (
              <div className="lg:col-span-2 space-y-3">
                <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-4)" }}>
                  Live Preview
                </p>
                <PreviewCard data={{
                  claimantName: form.claimantName, policyNumber: form.policyNumber,
                  claimType: form.claimType, claimAmount: form.claimAmount,
                  incidentDate: form.incidentDate, description: form.description,
                }} />
              </div>
            )}
          </div>
        )}

        {/* Step 3 — review & submit */}
        {step === 3 && (
          <div className="animate-slide-in max-w-xl space-y-5">
            <div className="card rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Review your claim</h2>
              <PreviewCard data={{
                claimantName: form.claimantName, policyNumber: form.policyNumber,
                claimType: form.claimType, claimAmount: form.claimAmount,
                incidentDate: form.incidentDate, description: form.description,
              }} />
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "var(--azure-dim)", border: "1px solid var(--azure-border)" }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--azure-bright)" }}>
                  What happens next
                </p>
                <div className="space-y-1.5">
                  {[
                    "Claude AI extracts and validates claim data",
                    "Risk score calculated automatically",
                    "Auto-approved if risk < 40 · Human review if needed",
                  ].map((t, i) => (
                    <p key={i} className="text-xs flex items-center gap-2" style={{ color: "var(--text-2)" }}>
                      <span style={{ color: "var(--azure)" }}>✦</span> {t}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--state-rejected)" + "1a", border: "1px solid oklch(0.68 0.22 22 / 0.25)", color: "oklch(0.76 0.18 22)" }}
                role="alert">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="rounded-lg px-4 py-2 text-sm transition-all duration-200 btn-ghost">
                ← Edit
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-200 disabled:opacity-40 btn-primary">
                {submitting ? "Submitting…" : "Submit Claim"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
