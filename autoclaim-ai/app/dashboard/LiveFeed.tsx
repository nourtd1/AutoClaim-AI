"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FeedEvent } from "@/lib/types";

const ACTOR: Record<string, { label: string; bg: string; border: string; color: string; symbol: string }> = {
  AGENT: { label: "AI Agent", symbol: "✦", bg: "oklch(0.72 0.18 142 / 0.11)", border: "oklch(0.72 0.18 142 / 0.25)", color: "oklch(0.82 0.16 142)" },
  ROBOT: { label: "Robot",    symbol: "◆", bg: "oklch(0.65 0.15 195 / 0.11)", border: "oklch(0.65 0.15 195 / 0.25)", color: "oklch(0.75 0.12 195)" },
  HUMAN: { label: "Human",    symbol: "●", bg: "oklch(0.80 0.13 78 / 0.11)",  border: "oklch(0.80 0.13 78 / 0.25)",  color: "oklch(0.88 0.11 78)" },
};

const STAGE_COLOR: Record<string, string> = {
  INTAKE:            "oklch(0.38 0.005 140)",
  EXTRACTION:        "oklch(0.70 0.17 230)",
  VALIDATION:        "oklch(0.72 0.18 142)",
  EXCEPTION_ROUTING: "oklch(0.80 0.13 78)",
  HUMAN_REVIEW:      "oklch(0.88 0.11 78)",
  RESOLUTION:        "oklch(0.72 0.18 142)",
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
    <div className="card-glow rounded-xl p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Live Feed</h2>
          <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{
              background: isOnline ? "oklch(0.72 0.18 142 / 0.09)" : "oklch(0.38 0.005 140 / 0.10)",
              border: `1px solid ${isOnline ? "oklch(0.72 0.18 142 / 0.22)" : "oklch(0.38 0.005 140 / 0.22)"}`,
            }}>
            <div className="h-1.5 w-1.5 rounded-full"
              style={{
                background: apiOk === null
                  ? "oklch(0.38 0.005 140)"
                  : apiOk
                  ? "oklch(0.72 0.18 142)"
                  : "oklch(0.68 0.22 22)",
                animation: isOnline ? "live-dot 1.8s ease-out infinite" : "none",
              }} />
            <span className="text-[9px] font-bold uppercase tracking-widest"
              style={{
                color: apiOk === null
                  ? "oklch(0.38 0.005 140)"
                  : apiOk
                  ? "oklch(0.72 0.18 142)"
                  : "oklch(0.68 0.22 22)",
              }}>
              {apiOk === null ? "checking" : apiOk ? "live" : "offline"}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-mono-id" style={{ color: "var(--text-4)" }}>↻ 5s</span>
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

      {/* Events — hauteur contrainte, scroll interne */}
      <ul ref={listRef} className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {events.length === 0 && (
          <li className="py-8 text-center flex flex-col items-center gap-2.5"
            style={{ color: "var(--text-4)" }}>
            <div className="flex gap-1.5">
              <div className="dot-1 h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-4)" }} />
              <div className="dot-2 h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-4)" }} />
              <div className="dot-3 h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-4)" }} />
            </div>
            <span className="text-xs">Waiting for activity…</span>
          </li>
        )}
        {events.map((ev, i) => {
          const a = ACTOR[ev.actor];
          const stageColor = STAGE_COLOR[ev.stage] ?? "var(--text-4)";
          return (
            <li key={ev.id}
              className="flex items-center gap-2.5 text-xs animate-stagger rounded-lg px-2 py-1.5 transition-colors"
              style={{
                "--i": i,
                background: "transparent",
              } as React.CSSProperties}>
              <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                style={a
                  ? { background: a.bg, border: `1px solid ${a.border}`, color: a.color }
                  : { background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-4)" }
                }>
                {ev.actor === "AGENT" ? "✦" : ev.actor === "ROBOT" ? "◆" : "●"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate leading-snug">
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{ev.claimantName}</span>
                  <span className="mx-1" style={{ color: "var(--text-4)" }}>·</span>
                  <span className="text-[11px]" style={{ color: stageColor }}>
                    {ev.stage.replace(/_/g, " ")}
                  </span>
                </p>
                {ev.notes && (
                  <p className="truncate text-[10px]" style={{ color: "var(--text-4)" }}>
                    {ev.notes}
                  </p>
                )}
              </div>
              <time className="shrink-0 font-mono-id tabular-nums text-[10px]"
                style={{ color: "var(--text-4)" }}>
                {relTime(ev.timestamp)}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
