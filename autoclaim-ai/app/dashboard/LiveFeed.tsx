"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface FeedEvent {
  id: string;
  stage: string;
  status: string;
  actor: string;
  notes: string | null;
  timestamp: string;
  claimantName: string;
}

const ACTOR_ICON: Record<string, string> = { AGENT: "🧠", ROBOT: "⚙️", HUMAN: "👤" };

const STAGE_COLOR: Record<string, string> = {
  INTAKE: "text-slate-400",
  EXTRACTION: "text-blue-400",
  VALIDATION: "text-violet-400",
  EXCEPTION_ROUTING: "text-orange-400",
  HUMAN_REVIEW: "text-amber-400",
  RESOLUTION: "text-emerald-400",
};

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/claims?_t=" + Date.now());
      setApiOk(res.ok);
    } catch {
      setApiOk(false);
    }
    try {
      const res = await fetch("/api/review/stats");
      const json = await res.json();
      // Fetch recent events via dedicated endpoint
      const evRes = await fetch("/api/events?limit=10");
      if (evRes.ok) {
        const evJson = await evRes.json();
        if (evJson.data) setEvents(evJson.data as FeedEvent[]);
      }
      void json; // stats fetched for apiOk side-effect
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void fetchEvents();
    const id = setInterval(fetchEvents, 5000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  // Ping /api/claims every 10s for system status
  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch("/api/claims?_ping=1");
        setApiOk(r.ok);
      } catch { setApiOk(false); }
    };
    const id = setInterval(ping, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass rounded-xl p-5 space-y-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Live Feed</h2>
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${apiOk === null ? "bg-slate-600" : apiOk ? "bg-emerald-400 animate-status-pulse" : "bg-red-500"}`} />
          <span className="text-[10px] text-slate-500">
            {apiOk === null ? "checking…" : apiOk ? "System online" : "System offline"}
          </span>
        </div>
      </div>

      <ul ref={listRef} className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {events.length === 0 && (
          <li className="text-xs text-slate-600 py-6 text-center">No recent activity</li>
        )}
        {events.map((ev) => (
          <li key={ev.id} className="flex items-start gap-2.5 text-xs animate-slide-in">
            <span className="mt-0.5 shrink-0">{ACTOR_ICON[ev.actor] ?? "•"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-slate-200 truncate">
                <span className="font-medium">{ev.claimantName}</span>
                {" — "}
                <span className={`font-semibold ${STAGE_COLOR[ev.stage] ?? "text-slate-400"}`}>
                  {ev.stage.replace(/_/g, " ")}
                </span>
              </p>
              {ev.notes && <p className="text-slate-600 truncate mt-0.5">{ev.notes}</p>}
            </div>
            <time className="shrink-0 text-[10px] text-slate-700 font-mono-id tabular-nums">{relTime(ev.timestamp)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
