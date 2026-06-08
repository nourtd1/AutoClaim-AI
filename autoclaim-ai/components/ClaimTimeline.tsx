"use client";

import type { StageEvent, ClaimStage } from "@/lib/types";

interface ClaimTimelineProps {
  events: StageEvent[];
  currentStage?: ClaimStage;
  StageIcon?: React.ComponentType<{ stage: string }>;
}

const ACTOR_ICON: Record<string, string> = {
  ROBOT: "⚙️",
  AGENT: "🧠",
  HUMAN: "👤",
};

const STAGE_COLOR: Record<string, { dot: string; line: string; label: string }> = {
  INTAKE:            { dot: "border-slate-500  bg-slate-900",    line: "bg-slate-700",   label: "text-slate-400" },
  EXTRACTION:        { dot: "border-blue-500   bg-blue-950",     line: "bg-blue-900",    label: "text-blue-400" },
  VALIDATION:        { dot: "border-violet-500 bg-violet-950",   line: "bg-violet-900",  label: "text-violet-400" },
  EXCEPTION_ROUTING: { dot: "border-orange-500 bg-orange-950",   line: "bg-orange-900",  label: "text-orange-400" },
  HUMAN_REVIEW:      { dot: "border-amber-500  bg-amber-950",    line: "bg-amber-900",   label: "text-amber-400" },
  RESOLUTION:        { dot: "border-emerald-500 bg-emerald-950", line: "bg-emerald-900", label: "text-emerald-400" },
};

const DEFAULT_SC = { dot: "border-slate-500 bg-slate-900", line: "bg-slate-700", label: "text-slate-400" };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function ClaimTimeline({ events, currentStage, StageIcon }: ClaimTimelineProps) {
  if (!events.length) {
    return <p className="text-xs text-slate-600 py-4 text-center">No timeline events yet</p>;
  }

  return (
    <ol className="relative space-y-0">
      {events.map((ev, i) => {
        const isLast   = i === events.length - 1;
        const isCurrent = isLast && ev.stage === currentStage;
        const sc = STAGE_COLOR[ev.stage] ?? DEFAULT_SC;

        return (
          <li key={ev.id} className="relative flex gap-3 pb-6">
            {!isLast && (
              <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${sc.line} opacity-40`} aria-hidden />
            )}

            <span
              className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${sc.dot} ${isCurrent ? "animate-status-pulse shadow-lg" : ""}`}
              title={ev.actor}
            >
              {StageIcon ? (
                <span className={`${sc.label}`}>
                  <StageIcon stage={ev.stage} />
                </span>
              ) : (
                <span className="text-sm">{ACTOR_ICON[ev.actor] ?? "•"}</span>
              )}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={`text-xs font-semibold uppercase tracking-wide ${sc.label}`}>
                  {ev.stage.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-slate-600 rounded-full border border-slate-800 px-1.5 py-px">
                  {ev.status.replace(/_/g, " ")}
                </span>
                <span className="ml-auto text-[10px] text-slate-600 font-mono-id" title={absoluteTime(ev.timestamp)}>
                  {ACTOR_ICON[ev.actor] ?? "•"} {ev.actor}
                </span>
              </div>
              {ev.notes && (
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{ev.notes}</p>
              )}
              <span className="mt-1.5 inline-block text-[10px] text-slate-600 font-mono-id cursor-default"
                title={absoluteTime(ev.timestamp)}>
                {relativeTime(ev.timestamp)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
