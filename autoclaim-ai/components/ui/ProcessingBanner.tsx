"use client";

import { useEffect, useState } from "react";

interface ProcessingBannerProps { status: string; }

const STATUS_TEXT: Record<string, string> = {
  EXTRACTING: "Claude AI is extracting claim data",
  VALIDATING: "Validation robot is processing",
};

export default function ProcessingBanner({ status }: ProcessingBannerProps) {
  const label = STATUS_TEXT[status];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!label) return;
    const id = setInterval(() => window.location.reload(), 4000);
    return () => clearInterval(id);
  }, [label]);

  if (!label || !visible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl px-5 py-4 flex items-center gap-4"
      style={{
        background: "oklch(0.72 0.18 142 / 0.07)",
        border: "1px solid oklch(0.72 0.18 142 / 0.28)",
      }}>
      {/* Sweeping signal line */}
      <div className="absolute inset-y-0 w-24 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, oklch(0.72 0.18 142 / 0.15) 50%, transparent 100%)",
          animation: "signal-sweep 2.4s cubic-bezier(0.22,1,0.36,1) infinite",
        }} />

      {/* Spinner */}
      <svg width="20" height="20" viewBox="0 0 22 22" className="shrink-0 animate-spin" style={{ animationDuration: "0.85s" }}>
        <circle cx="11" cy="11" r="9" fill="none" stroke="oklch(0.72 0.18 142 / 0.20)" strokeWidth="2.5"/>
        <path d="M11 2 A9 9 0 0 1 20 11" fill="none" stroke="oklch(0.72 0.18 142)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "oklch(0.82 0.16 142)" }}>{label}</p>
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "oklch(0.72 0.18 142 / 0.55)" }}>
          Agent processing
          <span className="dot-1 inline-block w-1 h-1 rounded-full" style={{ background: "oklch(0.72 0.18 142 / 0.55)" }} />
          <span className="dot-2 inline-block w-1 h-1 rounded-full" style={{ background: "oklch(0.72 0.18 142 / 0.55)" }} />
          <span className="dot-3 inline-block w-1 h-1 rounded-full" style={{ background: "oklch(0.72 0.18 142 / 0.55)" }} />
        </p>
      </div>

      <button onClick={() => setVisible(false)} aria-label="Dismiss"
        className="shrink-0 text-lg leading-none transition-opacity opacity-35 hover:opacity-70"
        style={{ color: "oklch(0.72 0.18 142)" }}>×</button>
    </div>
  );
}
