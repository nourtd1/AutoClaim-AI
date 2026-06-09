"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STAGES = [
  { key: "INTAKE",       label: "Intake",         type: "auto"   },
  { key: "EXTRACTION",   label: "AI Extraction",  type: "auto"   },
  { key: "VALIDATION",   label: "Validation",     type: "auto"   },
  { key: "HUMAN_REVIEW", label: "Human Review",   type: "manual" },
  { key: "RESOLUTION",   label: "Resolution",     type: "auto"   },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

// Map terminal statuses to their visual stage
const TERMINAL_STAGE: Record<string, StageKey> = {
  APPROVED:  "RESOLUTION",
  REJECTED:  "RESOLUTION",
  ESCALATED: "HUMAN_REVIEW",
};

interface Props {
  claimId:        string;
  initialStage?:  string | null | undefined;
  initialStatus?: string | null | undefined;
  onStageUpdate?: ((status: string, stage: string | null) => void) | undefined;
}

export default function ClaimStageProgress({
  claimId,
  initialStage,
  initialStatus,
  onStageUpdate,
}: Props) {
  const [activeStage, setActiveStage] = useState<string>(
    initialStage ?? "INTAKE"
  );
  const [claimStatus, setClaimStatus] = useState<string>(
    initialStatus ?? "SUBMITTED"
  );
  const [connected, setConnected] = useState(false);
  const [done,      setDone]      = useState(
    () => ["APPROVED", "REJECTED", "ESCALATED"].includes(initialStatus ?? "")
  );
  const esRef    = useRef<EventSource | null>(null);
  const doneRef  = useRef(done);
  doneRef.current = done;

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();
    if (doneRef.current) return;

    const es = new EventSource(`/api/claims/${claimId}/stream`);
    esRef.current = es;

    es.addEventListener("connected",    () => setConnected(true));

    es.addEventListener("stage_update", (e) => {
      const d = JSON.parse(e.data) as { status: string; stage: string };
      setActiveStage(d.stage);
      setClaimStatus(d.status);
      onStageUpdate?.(d.status, d.stage);
    });

    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data) as { finalStatus: string; finalStage: string };
      setActiveStage(TERMINAL_STAGE[d.finalStatus] ?? d.finalStage);
      setClaimStatus(d.finalStatus);
      setDone(true);
      es.close();
    });

    es.addEventListener("error", () => {
      setConnected(false);
      es.close();
      if (!doneRef.current) setTimeout(connect, 6000);
    });
  }, [claimId, onStageUpdate]);

  useEffect(() => {
    if (!done) connect();
    return () => esRef.current?.close();
  }, [connect, done]);

  const stageIdx = STAGES.findIndex((s) => s.key === activeStage);

  const statusColor = () => {
    if (claimStatus === "APPROVED")  return "bg-emerald-900 border-emerald-700 text-emerald-300";
    if (claimStatus === "REJECTED")  return "bg-red-900 border-red-700 text-red-300";
    if (claimStatus === "ESCALATED") return "bg-rose-900 border-rose-700 text-rose-300";
    if (connected)                   return "bg-blue-900 border-blue-700 text-blue-300";
    return "bg-slate-800 border-slate-700 text-slate-400";
  };

  return (
    <div className="glass rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Maestro Pipeline
        </h3>
        <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${statusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block bg-current ${connected && !done ? "animate-status-pulse" : ""}`} />
          {done        ? claimStatus.replace(/_/g, " ") :
           connected   ? "Live"                         :
                         "Reconnecting…"}
        </span>
      </div>

      {/* Stages */}
      <div className="relative flex justify-between items-start">
        {/* Connector line */}
        <div className="absolute top-4 left-4 right-4 h-px bg-slate-800" aria-hidden />

        {STAGES.map((stage, idx) => {
          const isCompleted = idx < stageIdx;
          const isActive    = idx === stageIdx;

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center flex-1">
              {/* Circle */}
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                border-2 transition-all duration-500
                ${isCompleted
                  ? "bg-emerald-900 border-emerald-500 text-emerald-300"
                  : isActive
                  ? "bg-violet-900 border-violet-500 text-violet-200 scale-110 shadow-lg ring-4 ring-violet-900/40"
                  : "bg-slate-900 border-slate-700 text-slate-600"}
              `}>
                {isCompleted ? "✓" : idx + 1}
              </div>

              {/* Label */}
              <span className={`
                mt-2 text-[10px] text-center leading-tight font-medium transition-colors
                ${isActive    ? "text-violet-300" :
                  isCompleted ? "text-emerald-400" : "text-slate-600"}
              `}>
                {stage.label}
              </span>

              {/* Type badge */}
              <span className={`mt-1 text-[9px] px-1.5 py-px rounded-full ${
                stage.type === "manual"
                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                  : "bg-violet-950 text-violet-400 border border-violet-800"
              }`}>
                {stage.type === "manual" ? "Manual" : "Auto"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {!done && activeStage === "HUMAN_REVIEW" && (
        <p className="mt-4 text-xs text-center text-amber-300 bg-amber-950/50 border border-amber-800 rounded-lg py-2 px-4">
          ⏳ Awaiting adjuster decision — reviewer has been notified
        </p>
      )}
      {done && (
        <p className={`mt-4 text-xs text-center rounded-lg py-2 px-4 border ${
          claimStatus === "APPROVED"
            ? "text-emerald-300 bg-emerald-950/50 border-emerald-800"
            : claimStatus === "REJECTED"
            ? "text-red-300 bg-red-950/50 border-red-800"
            : "text-rose-300 bg-rose-950/50 border-rose-800"
        }`}>
          {claimStatus === "APPROVED"  ? "🎉 Claim approved and settled"         :
           claimStatus === "REJECTED"  ? "❌ Claim rejected"                      :
                                         "⬆️ Escalated for senior review"}
        </p>
      )}
    </div>
  );
}
