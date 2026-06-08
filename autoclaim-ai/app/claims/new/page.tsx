"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DropZone from "@/components/ui/DropZone";
import type { Claim } from "@/lib/types";

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done    = n < current;
        const active  = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              done   ? "border-emerald-500 bg-emerald-900 text-emerald-300" :
              active ? "border-violet-500 bg-violet-900 text-violet-200" :
                       "border-slate-700 bg-slate-900 text-slate-600"
            }`}>
              {done ? "✓" : n}
            </div>
            {n < total && (
              <div className={`h-0.5 w-6 rounded-full transition-colors ${done ? "bg-emerald-700" : "bg-slate-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const STEP_LABELS = ["Choose method", "Fill details", "Review & submit"];

// ── Preview card (ghost) ──────────────────────────────────────────────────────

interface PreviewData {
  claimantName: string; policyNumber: string; claimType: string;
  claimAmount: string; incidentDate: string; description: string;
}

function PreviewCard({ data }: { data: PreviewData }) {
  const empty = !data.claimantName && !data.policyNumber;
  const amount = parseFloat(data.claimAmount);

  return (
    <div className={`glass rounded-xl p-4 space-y-3 transition-opacity duration-300 ${empty ? "opacity-30" : "opacity-100"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-100 text-sm truncate">
            {data.claimantName || <span className="text-slate-600 italic">Claimant name…</span>}
          </p>
          <p className="font-mono-id text-[11px] text-slate-500 mt-0.5">
            {data.policyNumber || <span className="italic">POL-…</span>}
          </p>
        </div>
        <span className="text-[10px] border border-slate-700 bg-slate-900 rounded-full px-2 py-0.5 text-slate-400 shrink-0">
          {data.claimType || "TYPE"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono-id font-bold text-emerald-400 text-base">
          {!isNaN(amount) && amount > 0
            ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
            : <span className="text-slate-700 text-sm italic">$0</span>}
        </span>
        <span className="text-[11px] text-slate-500">
          {data.incidentDate || <span className="italic">date</span>}
        </span>
      </div>

      {data.description && (
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{data.description}</p>
      )}

      {/* Stage progress bar */}
      <div className="h-0.5 w-full rounded-full bg-slate-800">
        <div className="h-full w-1/6 rounded-full bg-violet-600 transition-all" />
      </div>
      <p className="text-[9px] text-slate-700 uppercase tracking-widest">Preview — SUBMITTED · INTAKE</p>
    </div>
  );
}

// ── Form ──────────────────────────────────────────────────────────────────────

const CLAIM_TYPES = ["PROPERTY_DAMAGE","MEDICAL","VEHICLE","THEFT","LIABILITY","TRAVEL"] as const;
const CURRENCIES  = ["USD","EUR","GBP","CAD"] as const;

export default function NewClaimPage() {
  const router = useRouter();
  const [mode, setMode]   = useState<"form"|"upload">("form");
  const [step, setStep]   = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    claimantName: "", claimantEmail: "", policyNumber: "",
    claimType: "PROPERTY_DAMAGE" as typeof CLAIM_TYPES[number],
    incidentDate: "", claimAmount: "", currency: "USD" as typeof CURRENCIES[number],
    description: "", source: "FORM" as "FORM"|"EMAIL"|"PDF",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const previewData: PreviewData = {
    claimantName: form.claimantName, policyNumber: form.policyNumber,
    claimType: form.claimType, claimAmount: form.claimAmount,
    incidentDate: form.incidentDate, description: form.description,
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          claimAmount: parseFloat(form.claimAmount),
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Submission failed");
      const claim = json.data as Claim;

      // Trigger orchestration (fire-and-forget)
      void fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId: claim.id }),
      });

      router.push(`/claims/${claim.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-white/10 bg-slate-900 text-slate-200 text-sm px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500";
  const labelClass = "block text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5";

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px]">AC</div>
          </Link>
          <span className="text-slate-700">/</span>
          <Link href="/claims" className="text-xs text-slate-400 hover:text-slate-200">Claims</Link>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-300">New</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 space-y-3">
          <h1 className="text-xl font-semibold text-slate-100">Submit New Claim</h1>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <StepIndicator current={step} total={3} />
            <p className="text-xs text-slate-500">{STEP_LABELS[step - 1]}</p>
          </div>
        </div>

        {/* Step 1 — Choose method */}
        {step === 1 && (
          <div className="animate-slide-in grid sm:grid-cols-2 gap-4 max-w-xl">
            {(["form","upload"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setStep(2); }}
                className={`glass glass-hover rounded-xl p-6 text-left space-y-2 transition-all border-2 ${
                  mode === m ? "border-violet-600" : "border-transparent"
                }`}
              >
                <span className="text-2xl">{m === "form" ? "📝" : "📂"}</span>
                <p className="font-semibold text-slate-200 text-sm">{m === "form" ? "Fill form" : "Upload file"}</p>
                <p className="text-xs text-slate-500">{m === "form" ? "Enter claim details manually" : "Upload PDF or email (.txt)"}</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Form or Upload */}
        {step === 2 && (
          <div className="animate-slide-in grid lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              {mode === "upload" ? (
                <DropZone
                  onSuccess={(result) => {
                    void fetch("/api/orchestrate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ claimId: result.claim.id }),
                    });
                    router.push(`/claims/${result.claim.id}`);
                  }}
                />
              ) : (
                <div className="glass rounded-xl p-6 space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Claimant Name *</label>
                      <input type="text" value={form.claimantName} onChange={set("claimantName")} placeholder="John Smith" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Email *</label>
                      <input type="email" value={form.claimantEmail} onChange={set("claimantEmail")} placeholder="john@email.com" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Policy Number *</label>
                      <input type="text" value={form.policyNumber} onChange={set("policyNumber")} placeholder="POL-2024-001" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Claim Type *</label>
                      <select value={form.claimType} onChange={set("claimType")} className={inputClass}>
                        {CLAIM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Incident Date *</label>
                      <input type="date" value={form.incidentDate} onChange={set("incidentDate")} className={inputClass} />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className={labelClass}>Amount *</label>
                        <input type="number" value={form.claimAmount} onChange={set("claimAmount")} placeholder="5000" min="0" step="0.01" className={inputClass} />
                      </div>
                      <div className="w-24">
                        <label className={labelClass}>Currency</label>
                        <select value={form.currency} onChange={set("currency")} className={inputClass}>
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description * (min 20 chars)</label>
                    <textarea value={form.description} onChange={set("description")} rows={3} placeholder="Describe the incident and damages in detail…" className={`${inputClass} resize-none`} />
                    <p className="mt-1 text-[10px] text-right text-slate-600">{form.description.length} chars</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:border-white/20 transition-colors">
                  ← Back
                </button>
                {mode === "form" && (
                  <button
                    onClick={() => setStep(3)}
                    disabled={!form.claimantName || !form.policyNumber || !form.incidentDate || !form.claimAmount || form.description.length < 20}
                    className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition-colors px-4 py-2 text-sm font-semibold text-white"
                  >
                    Review →
                  </button>
                )}
              </div>
            </div>

            {/* Live preview */}
            {mode === "form" && (
              <div className="lg:col-span-2 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Live Preview</p>
                <PreviewCard data={previewData} />
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Review & submit */}
        {step === 3 && (
          <div className="animate-slide-in max-w-xl space-y-5">
            <div className="glass rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">Review your claim</h2>
              <PreviewCard data={previewData} />
            </div>

            {error && (
              <div className="rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">{error}</div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:border-white/20">
                ← Edit
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-colors px-4 py-2.5 text-sm font-semibold text-white"
              >
                {submitting ? "Submitting…" : "⚡ Submit Claim"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
