"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface FeedEvent { id: string; stage: string; status: string; actor: string; notes: string | null; timestamp: string; claimantName: string; }

const ACTOR: Record<string, { label: string; bg: string; border: string; color: string; symbol: string }> = {
  AGENT: { label: "AI Agent", symbol: "✦", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)",  color: "#818CF8" },
  ROBOT: { label: "Robot",    symbol: "◆", bg: "rgba(13,148,136,0.12)",  border: "rgba(13,148,136,0.25)",  color: "#2DD4BF" },
  HUMAN: { label: "Human",    symbol: "●", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)",  color: "#FB923C" },
};

const STAGE_COLOR: Record<string, string> = {
  INTAKE: "#4A5568", EXTRACTION: "#3B82F6", VALIDATION: "#6366F1",
  EXCEPTION_ROUTING: "#F97316", HUMAN_REVIEW: "#FB923C", RESOLUTION: "#10B981",
};

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [apiOk,  setApiOk]  = useState<boolean | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchEvents = useCallback(async () => {
    try { const r = await fetch("/api/claims?_ping=1"); setApiOk(r.ok); } catch { setApiOk(false); }
    try {
      const ev = await fetch("/api/events?limit=12");
      if (ev.ok) { const j = await ev.json(); if (j.data) setEvents(j.data as FeedEvent[]); }
    } catch { /**/ }
  }, []);

  useEffect(() => {
    void fetchEvents();
    const id = setInterval(fetchEvents, 5000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const isOnline = apiOk === true;

  return (
    <div className="card-glow rounded-xl2 p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold" style={{ color: "#E8EBF4" }}>Live Feed</h2>
          <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              background: isOnline ? "rgba(99,102,241,0.1)" : "rgba(74,85,104,0.1)",
              border: `1px solid ${isOnline ? "rgba(99,102,241,0.2)" : "rgba(74,85,104,0.2)"}`,
            }}>
            <div className="h-1.5 w-1.5 rounded-full"
              style={{
                background: apiOk === null ? "#4A5568" : apiOk ? "#6366F1" : "#EF4444",
                animation: isOnline ? "live-dot 1.6s ease-out infinite" : "none",
              }} />
            <span className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: apiOk === null ? "#4A5568" : apiOk ? "#818CF8" : "#F87171" }}>
              {apiOk === null ? "checking" : apiOk ? "live" : "offline"}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono-id" style={{ color: "#3A4155" }}>↻ 5s</span>
      </div>

      {/* Actor legend */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {Object.entries(ACTOR).map(([k, a]) => (
          <span key={k} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: a.bg, border: `1px solid ${a.border}`, color: a.color }}>
            <span className="text-[11px]">{a.symbol}</span>
            {a.label}
          </span>
        ))}
      </div>

      {/* Events */}
      <ul ref={listRef} className="space-y-3 flex-1 overflow-y-auto pr-1">
        {events.length === 0 && (
          <li className="py-8 text-center flex flex-col items-center gap-2.5" style={{ color: "#3A4155" }}>
            <div className="flex gap-1.5">
              <div className="dot-1 h-1.5 w-1.5 rounded-full" style={{ background: "#3A4155" }} />
              <div className="dot-2 h-1.5 w-1.5 rounded-full" style={{ background: "#3A4155" }} />
              <div className="dot-3 h-1.5 w-1.5 rounded-full" style={{ background: "#3A4155" }} />
            </div>
            <span className="text-xs">Waiting for activity…</span>
          </li>
        )}
        {events.map((ev, i) => {
          const a = ACTOR[ev.actor];
          const stageColor = STAGE_COLOR[ev.stage] ?? "#4A5568";
          return (
            <li key={ev.id} className="flex items-start gap-2.5 text-xs animate-stagger"
              style={{ "--i": i } as React.CSSProperties}>
              <div className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                style={a ? { background: a.bg, border: `1px solid ${a.border}`, color: a.color } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#4A5568" }}>
                {ev.actor === "AGENT" ? "✦" : ev.actor === "ROBOT" ? "◆" : "●"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate leading-snug font-semibold" style={{ color: "#E8EBF4" }}>{ev.claimantName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="h-1 w-1 rounded-full shrink-0" style={{ background: stageColor }} />
                  <span className="text-[11px] font-medium" style={{ color: stageColor }}>{ev.stage.replace(/_/g, " ")}</span>
                </div>
                {ev.notes && <p className="truncate mt-0.5 text-[11px]" style={{ color: "#4A5568" }}>{ev.notes}</p>}
              </div>
              <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5" style={{ color: "#3A4155" }}>
                {relTime(ev.timestamp)}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
