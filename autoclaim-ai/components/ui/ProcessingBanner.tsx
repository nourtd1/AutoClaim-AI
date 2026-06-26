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
      style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
      {/* Shimmer sweep */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 50%, transparent 100%)", animation: "shimmer 2s infinite", backgroundSize: "200% 100%" }} />

      {/* Spinner */}
      <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0 animate-spin" style={{ animationDuration: "0.9s" }}>
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth="2.5"/>
        <path d="M11 2 A9 9 0 0 1 20 11" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#818CF8" }}>{label}</p>
        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "rgba(99,102,241,0.6)" }}>
          Agent processing
          <span className="dot-1 inline-block w-1 h-1 rounded-full" style={{ background: "rgba(99,102,241,0.6)" }} />
          <span className="dot-2 inline-block w-1 h-1 rounded-full" style={{ background: "rgba(99,102,241,0.6)" }} />
          <span className="dot-3 inline-block w-1 h-1 rounded-full" style={{ background: "rgba(99,102,241,0.6)" }} />
        </p>
      </div>

      <button onClick={() => setVisible(false)} aria-label="Dismiss"
        className="shrink-0 text-lg leading-none transition-opacity opacity-40 hover:opacity-80"
        style={{ color: "#818CF8" }}>×</button>
    </div>
  );
}
