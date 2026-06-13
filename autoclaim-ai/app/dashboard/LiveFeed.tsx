"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface FeedEvent {
  id: string; stage: string; status: string; actor: string;
  notes: string | null; timestamp: string; claimantName: string;
}

const ACTOR: Record<string, { label: string; color: string; bg: string; border: string }> = {
  AGENT: { label: "AI",    color: "#C084FC", bg: "rgba(168,85,247,0.18)",  border: "rgba(168,85,247,0.35)" },
  ROBOT: { label: "Robot", color: "#5EEAD4", bg: "rgba(20,184,166,0.15)",  border: "rgba(20,184,166,0.3)" },
  HUMAN: { label: "Human", color: "#FDE047", bg: "rgba(234,179,8,0.15)",   border: "rgba(234,179,8,0.3)" },
};

const STAGE_COLOR: Record<string, string> = {
  INTAKE:            "#9CA3AF",
  EXTRACTION:        "#93C5FD",
  VALIDATION:        "#D8B4FE",
  EXCEPTION_ROUTING: "#FCD34D",
  HUMAN_REVIEW:      "#FDE047",
  RESOLUTION:        "#6EE7B7",
};

function relTime(iso: string) {
  const s = Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  return `${Math.floor(s/3600)}h`;
}

const CARD_STYLE = {
  background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(124,58,237,0.04) 100%)",
  border: "1px solid rgba(168,85,247,0.18)",
  backdropFilter: "blur(24px)",
};

export default function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const r = await fetch("/api/claims?_ping=1");
      setApiOk(r.ok);
    } catch { setApiOk(false); }
    try {
      const ev = await fetch("/api/events?limit=12");
      if (ev.ok) {
        const j = await ev.json();
        if (j.data) setEvents(j.data as FeedEvent[]);
      }
    } catch { /**/ }
  }, []);

  useEffect(() => {
    void fetchEvents();
    const id = setInterval(fetchEvents, 5000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const statusColor = apiOk === null ? "#6B7280" : apiOk ? "#A855F7" : "#EF4444";
  const statusLabel = apiOk === null ? "checking" : apiOk ? "live" : "offline";

  return (
    <div className="rounded-xl2 p-5 h-full flex flex-col" style={CARD_STYLE}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold" style={{ color: "#FAF5FF" }}>Live Feed</h2>
          <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor, animation: apiOk ? "live-dot 1.6s ease-out infinite" : "none" }} />
            <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono-id" style={{ color: "rgba(168,85,247,0.3)" }}>↻ 5s</span>
      </div>

      {/* Actor legend */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {Object.entries(ACTOR).map(([key, a]) => (
          <span key={key}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: a.bg, border: `1px solid ${a.border}`, color: a.color }}>
            {key === "AGENT" ? "✦" : key === "ROBOT" ? "◆" : "●"} {a.label}
          </span>
        ))}
      </div>

      {/* Events */}
      <ul ref={listRef} className="space-y-3 flex-1 overflow-y-auto pr-1">
        {events.length === 0 && (
          <li className="py-8 text-center flex flex-col items-center gap-2.5" style={{ color: "rgba(168,85,247,0.35)" }}>
            <div className="flex gap-1.5">
              <div className="dot-1 h-1.5 w-1.5 rounded-full" style={{ background: "rgba(168,85,247,0.4)" }} />
              <div className="dot-2 h-1.5 w-1.5 rounded-full" style={{ background: "rgba(168,85,247,0.4)" }} />
              <div className="dot-3 h-1.5 w-1.5 rounded-full" style={{ background: "rgba(168,85,247,0.4)" }} />
            </div>
            <span className="text-xs">Waiting for activity…</span>
          </li>
        )}
        {events.map((ev, i) => {
          const a = ACTOR[ev.actor];
          const stageColor = STAGE_COLOR[ev.stage] ?? "#9CA3AF";
          return (
            <li key={ev.id} className="flex items-start gap-2.5 text-xs animate-slide-in" style={{ animationDelay: `${i*20}ms` }}>
              {/* Actor badge */}
              <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={a ? { background: a.bg, border: `1px solid ${a.border}`, color: a.color } : { background: "rgba(107,114,128,0.1)", border: "1px solid rgba(107,114,128,0.2)", color: "#9CA3AF" }}>
                {ev.actor === "AGENT" ? "✦" : ev.actor === "ROBOT" ? "◆" : "●"}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="truncate leading-snug font-semibold" style={{ color: "#E9D5FF" }}>{ev.claimantName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1 w-1 rounded-full shrink-0" style={{ background: stageColor }} />
                  <span className="text-[11px] font-medium" style={{ color: stageColor }}>{ev.stage.replace(/_/g," ")}</span>
                </div>
                {ev.notes && (
                  <p className="truncate mt-0.5 text-[11px]" style={{ color: "rgba(168,85,247,0.35)" }}>{ev.notes}</p>
                )}
              </div>

              {/* Time */}
              <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5" style={{ color: "rgba(168,85,247,0.3)" }}>
                {relTime(ev.timestamp)}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
