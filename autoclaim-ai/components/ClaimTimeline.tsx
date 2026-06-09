"use client";

import type { StageEvent, ClaimStage } from "@/lib/types";

// ── Stage SVG icons (defined here, not passed as prop across Server→Client boundary) ──

function StageIcon({ stage }: { stage: string }) {
  const cls = "w-3.5 h-3.5";
  switch (stage) {
    case "INTAKE": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    case "EXTRACTION": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    case "VALIDATION": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 5v4c0 3-2.5 4.5-6 5-3.5-.5-6-2-6-5V5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    case "EXCEPTION_ROUTING": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <path d="M8 2L14 14H2L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="12" r="0.75" fill="currentColor"/>
      </svg>
    );
    case "HUMAN_REVIEW": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2.5 13.5c0-2.5 2.5-4 5.5-4s5.5 1.5 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
    case "RESOLUTION": return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 8l2.5 2.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
    default: return (
      <svg className={cls} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    );
  }
}

interface ClaimTimelineProps {
  events: StageEvent[];
  currentStage?: ClaimStage;
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

export default function ClaimTimeline({ events, currentStage }: ClaimTimelineProps) {
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
              <span
                className="mt-1.5 inline-block text-[10px] text-slate-600 font-mono-id cursor-default"
                title={absoluteTime(ev.timestamp)}
                suppressHydrationWarning
              >
                {relativeTime(ev.timestamp)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
