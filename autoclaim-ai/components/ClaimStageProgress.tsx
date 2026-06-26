"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STAGES = [
  { key: "INTAKE",       label: "Intake",        type: "auto"   },
  { key: "EXTRACTION",   label: "AI Extraction", type: "auto"   },
  { key: "VALIDATION",   label: "Validation",    type: "auto"   },
  { key: "HUMAN_REVIEW", label: "Human Review",  type: "manual" },
  { key: "RESOLUTION",   label: "Resolution",    type: "auto"   },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const TERMINAL_STAGE: Record<string, StageKey> = {
  APPROVED: "RESOLUTION", REJECTED: "RESOLUTION", ESCALATED: "HUMAN_REVIEW",
};

interface Props {
  claimId: string;
  initialStage?: string | null | undefined;
  initialStatus?: string | null | undefined;
  onStageUpdate?: ((status: string, stage: string | null) => void) | undefined;
}

export default function ClaimStageProgress({ claimId, initialStage, initialStatus, onStageUpdate }: Props) {
  const [activeStage, setActiveStage] = useState<string>(initialStage ?? "INTAKE");
  const [claimStatus, setClaimStatus] = useState<string>(initialStatus ?? "SUBMITTED");
  const [connected,   setConnected]   = useState(false);
  const [done,        setDone]        = useState(() => ["APPROVED", "REJECTED", "ESCALATED"].includes(initialStatus ?? ""));
  const esRef   = useRef<EventSource | null>(null);
  const doneRef = useRef(done);
  doneRef.current = done;

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();
    if (doneRef.current) return;
    const es = new EventSource(`/api/claims/${claimId}/stream`);
    esRef.current = es;
    es.addEventListener("connected",    () => setConnected(true));
    es.addEventListener("stage_update", (e) => {
      const d = JSON.parse(e.data) as { status: string; stage: string };
      setActiveStage(d.stage); setClaimStatus(d.status);
      onStageUpdate?.(d.status, d.stage);
    });
    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data) as { finalStatus: string; finalStage: string };
      setActiveStage(TERMINAL_STAGE[d.finalStatus] ?? d.finalStage);
      setClaimStatus(d.finalStatus); setDone(true); es.close();
    });
    es.addEventListener("error", () => {
      setConnected(false); es.close();
      if (!doneRef.current) setTimeout(connect, 6000);
    });
  }, [claimId, onStageUpdate]);

  useEffect(() => {
    if (!done) connect();
    return () => esRef.current?.close();
  }, [connect, done]);

  const stageIdx = STAGES.findIndex(s => s.key === activeStage);

  const pill = (() => {
    if (claimStatus === "APPROVED")  return { bg: "oklch(0.72 0.18 142 / 0.11)", border: "oklch(0.72 0.18 142 / 0.30)", color: "oklch(0.82 0.16 142)", label: "APPROVED" };
    if (claimStatus === "REJECTED")  return { bg: "oklch(0.68 0.22 22 / 0.10)",  border: "oklch(0.68 0.22 22 / 0.30)",  color: "oklch(0.76 0.18 22)",  label: "REJECTED" };
    if (claimStatus === "ESCALATED") return { bg: "oklch(0.70 0.19 12 / 0.10)",  border: "oklch(0.70 0.19 12 / 0.30)",  color: "oklch(0.78 0.15 12)",  label: "ESCALATED" };
    if (connected)                   return { bg: "oklch(0.72 0.18 142 / 0.10)", border: "oklch(0.72 0.18 142 / 0.28)", color: "oklch(0.72 0.18 142)", label: "LIVE" };
    return                                  { bg: "oklch(0.72 0.18 142 / 0.06)", border: "oklch(0.72 0.18 142 / 0.14)", color: "oklch(0.72 0.18 142 / 0.50)", label: "Connecting…" };
  })();

  const progressPct = stageIdx <= 0 ? 0 : Math.min((stageIdx / (STAGES.length - 1)) * 90, 90);

  return (
    <div className="card-glow rounded-xl p-5 mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md flex items-center justify-center"
            style={{ background: "oklch(0.72 0.18 142 / 0.10)", border: "1px solid oklch(0.72 0.18 142 / 0.22)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="oklch(0.72 0.18 142)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.72 0.18 142 / 0.75)" }}>
            Maestro Pipeline
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
          style={{ background: pill.bg, border: `1px solid ${pill.border}`, color: pill.color }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: pill.color, animation: connected && !done ? "status-pulse 1.8s ease-in-out infinite" : "none" }} />
          {done ? claimStatus.replace(/_/g, " ") : connected ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* Stage track */}
      <div className="relative flex justify-between items-start">
        {/* Track bg */}
        <div className="absolute top-4 left-4 right-4 h-px" style={{ background: "oklch(0.72 0.18 142 / 0.10)" }} aria-hidden />
        {/* Progress fill */}
        <div className="absolute top-4 left-4 h-px"
          style={{
            background: "linear-gradient(90deg, oklch(0.72 0.18 142), oklch(0.82 0.16 142))",
            width: `${progressPct}%`,
            boxShadow: "0 0 8px oklch(0.72 0.18 142 / 0.40)",
            transition: "width 550ms cubic-bezier(0.16,1,0.3,1)",
          }} aria-hidden />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < stageIdx;
          const isActive    = idx === stageIdx;
          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center flex-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  transition: "all 350ms cubic-bezier(0.16,1,0.3,1)",
                  ...(isCompleted
                    ? { background: "oklch(0.72 0.18 142 / 0.18)", border: "2px solid oklch(0.72 0.18 142)", color: "oklch(0.82 0.16 142)" }
                    : isActive
                    ? { background: "oklch(0.72 0.18 142)", border: "2px solid oklch(0.72 0.18 142 / 0.50)", color: "oklch(0.09 0.000 0)", boxShadow: "0 0 18px oklch(0.72 0.18 142 / 0.50), 0 0 0 4px oklch(0.72 0.18 142 / 0.12)", transform: "scale(1.15)" }
                    : { background: "oklch(0.72 0.18 142 / 0.04)", border: "2px solid oklch(0.72 0.18 142 / 0.12)", color: "oklch(0.72 0.18 142 / 0.28)" }),
                }}>
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span className="mt-2 text-[10px] text-center leading-tight font-semibold transition-colors"
                style={{ color: isActive ? "oklch(0.82 0.16 142)" : isCompleted ? "oklch(0.72 0.18 142 / 0.60)" : "oklch(0.72 0.18 142 / 0.25)" }}>
                {stage.label}
              </span>
              <span className="mt-1 text-[9px] px-1.5 py-px rounded-full"
                style={stage.type === "manual"
                  ? { background: "oklch(0.80 0.13 78 / 0.09)", color: "oklch(0.88 0.11 78)", border: "1px solid oklch(0.80 0.13 78 / 0.22)" }
                  : { background: "oklch(0.72 0.18 142 / 0.07)", color: "oklch(0.72 0.18 142 / 0.60)", border: "1px solid oklch(0.72 0.18 142 / 0.15)" }}>
                {stage.type === "manual" ? "Manual" : "Auto"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {!done && activeStage === "HUMAN_REVIEW" && (
        <div className="mt-5 text-xs text-center py-2.5 px-4 rounded-lg flex items-center justify-center gap-2"
          style={{
            background: "oklch(0.80 0.13 78 / 0.07)",
            border: "1px solid oklch(0.80 0.13 78 / 0.20)",
            color: "oklch(0.88 0.11 78)",
          }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Awaiting adjuster decision — reviewer has been notified
        </div>
      )}
      {done && (
        <div className="mt-5 text-xs text-center py-2.5 px-4 rounded-lg animate-slide-up-in"
          style={
            claimStatus === "APPROVED"
              ? { background: "oklch(0.72 0.18 142 / 0.07)", border: "1px solid oklch(0.72 0.18 142 / 0.22)", color: "oklch(0.82 0.16 142)" }
              : claimStatus === "REJECTED"
              ? { background: "oklch(0.68 0.22 22 / 0.07)", border: "1px solid oklch(0.68 0.22 22 / 0.22)", color: "oklch(0.76 0.18 22)" }
              : { background: "oklch(0.70 0.19 12 / 0.07)", border: "1px solid oklch(0.70 0.19 12 / 0.22)", color: "oklch(0.78 0.15 12)" }
          }>
          {claimStatus === "APPROVED" ? "✓ Claim approved and settled" :
           claimStatus === "REJECTED" ? "✗ Claim rejected" :
                                        "↑ Escalated for senior review"}
        </div>
      )}
    </div>
  );
}
