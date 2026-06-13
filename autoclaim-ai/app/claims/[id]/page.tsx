import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getClaimById, getClaimTimeline, getReviewerById } from "@/lib/db";
import type { Claim, ExtractedData, ValidationResult } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import ClaimTimeline from "@/components/ClaimTimeline";
import ReviewPanel from "@/components/ReviewPanel";
import ProcessingBanner from "@/components/ui/ProcessingBanner";
import ConfettiBurst from "@/components/ui/ConfettiBurst";
import ClaimPageLiveWrapper from "@/components/ClaimPageLiveWrapper";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  await initDb();
  const claim = await getClaimById(params.id);
  if (!claim) return { title: "Claim Not Found" };
  return { title: `${claim.claimantName} — ${claim.policyNumber}` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}


// ── Sub-components (server-safe, no hooks) ────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value < 0.5 ? "bg-red-500" : value < 0.8 ? "bg-orange-500" : "bg-emerald-500";
  const label = value < 0.5 ? "text-red-400" : value < 0.8 ? "text-orange-400" : "text-emerald-400";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Extraction confidence</span>
        <span className={`font-mono-id font-bold ${label}`}>{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const R = 36;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;
  const color = score < 40 ? "#10B981" : score < 70 ? "#F97316" : "#EF4444";
  const label = score < 40 ? "text-emerald-400" : score < 70 ? "text-orange-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={R} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="48" cy="48" r={R} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${CIRC}`} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="text-center -mt-14 mb-6">
        <p className={`text-2xl font-bold font-mono-id ${label}`}>{score}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">risk score</p>
      </div>
    </div>
  );
}

function Checkpoint({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${ok ? "bg-emerald-900 text-emerald-400" : "bg-red-900 text-red-400"}`}>
        {ok ? "✓" : "✗"}
      </span>
      <span className={ok ? "text-slate-300" : "text-slate-500 line-through"}>{label}</span>
    </div>
  );
}

function ExpandableText({ text }: { text: string }) {
  const LIMIT = 200;
  if (text.length <= LIMIT) return <p className="text-xs text-slate-400 leading-relaxed">{text}</p>;
  return (
    <details>
      <summary className="cursor-pointer text-xs text-slate-400 leading-relaxed list-none">
        {text.slice(0, LIMIT)}
        <span className="ml-1 text-violet-400 hover:underline">… read more</span>
      </summary>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</p>
    </details>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</p>
      <p className={`text-sm text-slate-200 ${mono ? "font-mono-id" : ""}`}>{value}</p>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClaimDetailPage({ params }: { params: { id: string } }) {
  await initDb();
  const claim: Claim | null = await getClaimById(params.id);
  if (!claim) notFound();

  const [timeline, reviewer] = await Promise.all([
    getClaimTimeline(claim.id),
    claim.assignedTo ? getReviewerById(claim.assignedTo) : Promise.resolve(null),
  ]);

  const ex: ExtractedData | null = claim.extractedData;
  const vr: ValidationResult | null = claim.validationResult;
  const isProcessing = claim.status === "EXTRACTING" || claim.status === "VALIDATING";
  const needsReview   = claim.status === "PENDING_REVIEW" || claim.status === "ESCALATED";
  const isResolved    = claim.status === "APPROVED" || claim.status === "REJECTED";

  return (
    <div className="min-h-screen">
      <ConfettiBurst trigger={isResolved} />

      {/* ── Hackathon banner ── */}
      <div className="px-6 py-2 flex items-center justify-center gap-2"
        style={{ background:"linear-gradient(90deg,rgba(124,58,237,0.4),rgba(168,85,247,0.3),rgba(236,72,153,0.2))", borderBottom:"1px solid rgba(168,85,247,0.2)" }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color:"#FCD34D" }}>
          <path d="M8 1l2 4h4l-3 3 1 4-4-2-4 2 1-4L2 5h4L8 1Z" fill="currentColor"/>
        </svg>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color:"#E9D5FF" }}>UiPath AgentHack 2026</span>
        <span className="text-[11px]" style={{ color:"rgba(168,85,247,0.4)" }}>·</span>
        <span className="text-[11px]" style={{ color:"rgba(196,132,252,0.7)" }}>Track 1: Maestro Case Orchestration</span>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40" style={{ background:"rgba(10,5,20,0.92)", backdropFilter:"blur(24px)", borderBottom:"1px solid rgba(168,85,247,0.14)" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background:"linear-gradient(90deg,transparent,rgba(168,85,247,0.5),rgba(236,72,153,0.4),transparent)" }} />
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="flex items-center gap-1.5 group">
              <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background:"linear-gradient(135deg,#A855F7,#7C3AED,#EC4899)", boxShadow:"0 0 8px rgba(168,85,247,0.4)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M4 12h4l2-6 2 12 2-8 1 4h5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </Link>
            <span style={{ color:"rgba(168,85,247,0.3)" }}>/</span>
            <Link href="/claims" className="text-xs transition-colors" style={{ color:"rgba(196,132,252,0.6)" }}>Claims</Link>
            <span style={{ color:"rgba(168,85,247,0.3)" }}>/</span>
            <span className="font-mono-id text-xs" style={{ color:"rgba(168,85,247,0.5)" }}>{claim.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={claim.status} />
            <PriorityBadge priority={claim.priority} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Title row ── */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="text-xl font-bold" style={{ color:"#FAF5FF" }}>{claim.claimantName}</h1>
            <p className="font-mono-id text-xs mt-0.5" style={{ color:"rgba(168,85,247,0.4)" }}>{claim.policyNumber}</p>
          </div>
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.25)", color:"rgba(196,132,252,0.8)" }}>
            via {claim.source}
          </span>
        </div>

        {/* Live Maestro pipeline progress (SSE — auto-refreshes page on transitions) */}
        <ClaimPageLiveWrapper
          claimId={claim.id}
          initialStage={claim.stage}
          initialStatus={claim.status}
        />

        {/* Processing banner (client component — triggers page refresh) */}
        {isProcessing && <div className="mb-2"><ProcessingBanner status={claim.status} /></div>}

        {/* ── Two-column layout ── */}
        <div className="grid lg:grid-cols-5 gap-6 items-start">

          {/* ════ Left (60%) ════ */}
          <div className="lg:col-span-3 space-y-5">

            <Section title="Claim Information">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <InfoRow label="Claimant"      value={claim.claimantName} />
                <InfoRow label="Email"         value={claim.claimantEmail} />
                <InfoRow label="Policy Number" value={claim.policyNumber} mono />
                <InfoRow label="Claim Type"    value={claim.claimType.replace(/_/g, " ")} />
                <InfoRow label="Amount"        value={fmtAmount(claim.claimAmount, claim.currency)} mono />
                <InfoRow label="Incident Date" value={fmtDate(claim.incidentDate)} />
                <InfoRow label="Submitted"     value={fmtDateTime(claim.createdAt)} />
                <InfoRow label="Updated"       value={fmtDateTime(claim.updatedAt)} />
                {claim.resolvedAt && <InfoRow label="Resolved" value={fmtDateTime(claim.resolvedAt)} />}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5">Description</p>
                <ExpandableText text={claim.description} />
              </div>
            </Section>

            {ex && (
              <Section
                title="AI Extraction Results"
                badge={
                  <span className="flex items-center gap-1.5 rounded-full border border-violet-700 bg-violet-950 px-2 py-0.5 text-[10px] text-violet-300">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M6 6c0-1 .8-2 2-2s2 .9 2 2c0 .8-.4 1.4-1 1.8L8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="8" cy="11.5" r=".75" fill="currentColor"/>
                    </svg>
                    Claude AI
                  </span>
                }
              >
                <ConfidenceBar value={ex.confidence} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {ex.policyNumber    && <InfoRow label="Policy #"         value={ex.policyNumber} mono />}
                  {ex.claimantName    && <InfoRow label="Claimant"         value={ex.claimantName} />}
                  {ex.incidentDate    && <InfoRow label="Incident Date"    value={fmtDate(ex.incidentDate)} />}
                  {ex.claimAmount != null && <InfoRow label="Amount"       value={fmtAmount(ex.claimAmount, claim.currency)} mono />}
                  {ex.claimType       && <InfoRow label="Claim Type"       value={ex.claimType} />}
                </div>
                {ex.documentList.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-1.5">
                      Documents Found ({ex.documentList.length})
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {ex.documentList.map((d) => (
                        <li key={d} className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-400">{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {ex.missingFields.length > 0 && (
                  <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-medium mb-1.5">Missing Fields</p>
                    <ul className="space-y-1">
                      {ex.missingFields.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-red-300">
                          <span className="text-red-500">✗</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>
            )}

            {vr && (
              <Section title="Validation Results">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <RiskGauge score={vr.riskScore} />
                  <div className="flex-1 space-y-2.5">
                    <Checkpoint label="Policy Verified"     ok={vr.policyExists} />
                    <Checkpoint label="Documents Complete"  ok={vr.documentsComplete} />
                    <Checkpoint label="Amount Within Limit" ok={vr.amountWithinLimit} />
                    <Checkpoint label="Risk Acceptable"     ok={vr.riskScore < 70} />
                  </div>
                </div>
                {vr.errors.length > 0 && (
                  <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">Errors</p>
                    {vr.errors.map((e) => (
                      <p key={e} className="text-xs text-red-300 flex gap-1.5"><span className="text-red-500 shrink-0">✗</span>{e}</p>
                    ))}
                  </div>
                )}
                {vr.warnings.length > 0 && (
                  <div className="rounded-lg border border-orange-900 bg-orange-950/60 px-3 py-2.5 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Warnings</p>
                    {vr.warnings.map((w) => (
                      <p key={w} className="text-xs text-orange-300 flex gap-1.5"><span className="text-orange-500 shrink-0">⚠</span>{w}</p>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* ════ Right (40%) ════ */}
          <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-20" id="review">
            {(needsReview || isResolved) && (
              <Section title={needsReview ? "Human Review" : "Decision"}>
                <ReviewPanel claim={claim} reviewer={reviewer} />
              </Section>
            )}

            <section className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-200">Orchestration Timeline</h2>
                <span className="text-[10px] text-slate-600 font-mono-id">{timeline.length} events</span>
              </div>
              <ClaimTimeline events={timeline} currentStage={claim.stage} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
