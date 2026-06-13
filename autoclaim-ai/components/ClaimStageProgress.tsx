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
  const [activeStage,  setActiveStage]  = useState<string>(initialStage ?? "INTAKE");
  const [claimStatus,  setClaimStatus]  = useState<string>(initialStatus ?? "SUBMITTED");
  const [connected,    setConnected]    = useState(false);
  const [done,         setDone]         = useState(() => ["APPROVED","REJECTED","ESCALATED"].includes(initialStatus ?? ""));
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

  const statusPill = () => {
    if (claimStatus === "APPROVED")  return { bg:"rgba(16,185,129,0.15)",  border:"rgba(16,185,129,0.35)",  color:"#6EE7B7", label:"APPROVED" };
    if (claimStatus === "REJECTED")  return { bg:"rgba(239,68,68,0.15)",   border:"rgba(239,68,68,0.35)",   color:"#FCA5A5", label:"REJECTED" };
    if (claimStatus === "ESCALATED") return { bg:"rgba(236,72,153,0.15)",  border:"rgba(236,72,153,0.35)",  color:"#F9A8D4", label:"ESCALATED" };
    if (connected)                   return { bg:"rgba(168,85,247,0.15)",  border:"rgba(168,85,247,0.35)",  color:"#C084FC", label:"LIVE" };
    return                                  { bg:"rgba(168,85,247,0.07)",  border:"rgba(168,85,247,0.18)",  color:"rgba(196,132,252,0.6)", label:"Connecting…" };
  };
  const pill = statusPill();

  return (
    <div className="rounded-xl p-5 mb-6" style={{
      background: "linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(124,58,237,0.05) 100%)",
      border: "1px solid rgba(168,85,247,0.2)",
      backdropFilter: "blur(24px)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ background:"rgba(168,85,247,0.2)", border:"1px solid rgba(168,85,247,0.3)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color:"#C084FC" }}>
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color:"rgba(196,132,252,0.8)" }}>
            Maestro Pipeline
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
          style={{ background:pill.bg, border:`1px solid ${pill.border}`, color:pill.color }}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block`}
            style={{ background:pill.color, animation: connected && !done ? "status-pulse 1.8s ease-in-out infinite" : "none" }} />
          {done ? claimStatus.replace(/_/g," ") : connected ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* Stages */}
      <div className="relative flex justify-between items-start">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-px" style={{ background:"rgba(168,85,247,0.15)" }} aria-hidden />
        {/* Progress line */}
        <div className="absolute top-4 left-4 h-px transition-all duration-700"
          style={{
            background:"linear-gradient(90deg,#A855F7,#C084FC)",
            width: stageIdx <= 0 ? "0%" : `${Math.min((stageIdx / (STAGES.length-1)) * 90, 90)}%`,
          }} aria-hidden />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < stageIdx;
          const isActive    = idx === stageIdx;
          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                style={
                  isCompleted ? { background:"rgba(168,85,247,0.25)", border:"2px solid #A855F7", color:"#C084FC" } :
                  isActive    ? { background:"linear-gradient(135deg,#A855F7,#7C3AED)", border:"2px solid rgba(168,85,247,0.6)", color:"#FAF5FF", boxShadow:"0 0 16px rgba(168,85,247,0.6), 0 0 0 4px rgba(168,85,247,0.15)", transform:"scale(1.15)" } :
                                { background:"rgba(168,85,247,0.05)", border:"2px solid rgba(168,85,247,0.15)", color:"rgba(168,85,247,0.3)" }
                }
              >
                {isCompleted ? "✓" : idx + 1}
              </div>
              <span className="mt-2 text-[10px] text-center leading-tight font-semibold transition-colors"
                style={{ color: isActive ? "#C084FC" : isCompleted ? "rgba(168,85,247,0.6)" : "rgba(168,85,247,0.3)" }}>
                {stage.label}
              </span>
              <span className="mt-1 text-[9px] px-1.5 py-px rounded-full"
                style={stage.type === "manual"
                  ? { background:"rgba(245,158,11,0.1)", color:"#FCD34D", border:"1px solid rgba(245,158,11,0.25)" }
                  : { background:"rgba(168,85,247,0.1)", color:"rgba(196,132,252,0.7)", border:"1px solid rgba(168,85,247,0.2)" }}>
                {stage.type === "manual" ? "Manual" : "Auto"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {!done && activeStage === "HUMAN_REVIEW" && (
        <div className="mt-5 text-xs text-center py-2.5 px-4 rounded-xl flex items-center justify-center gap-2"
          style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", color:"#FCD34D" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Awaiting adjuster decision — reviewer has been notified
        </div>
      )}
      {done && (
        <div className="mt-5 text-xs text-center py-2.5 px-4 rounded-xl"
          style={
            claimStatus === "APPROVED"
              ? { background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", color:"#6EE7B7" }
              : claimStatus === "REJECTED"
              ? { background:"rgba(239,68,68,0.08)",  border:"1px solid rgba(239,68,68,0.25)",  color:"#FCA5A5" }
              : { background:"rgba(236,72,153,0.08)", border:"1px solid rgba(236,72,153,0.25)", color:"#F9A8D4" }
          }>
          {claimStatus === "APPROVED"  ? "🎉 Claim approved and settled"   :
           claimStatus === "REJECTED"  ? "❌ Claim rejected"                :
                                         "⬆️ Escalated for senior review"}
        </div>
      )}
    </div>
  );
}
