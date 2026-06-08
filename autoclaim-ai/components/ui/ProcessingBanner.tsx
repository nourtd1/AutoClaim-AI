"use client";

import { useEffect, useState } from "react";

interface ProcessingBannerProps {
  status: string;
}

const STATUS_TEXT: Record<string, string> = {
  EXTRACTING: "Claude AI is extracting claim data",
  VALIDATING: "Validation robot is processing",
};

export default function ProcessingBanner({ status }: ProcessingBannerProps) {
  const label = STATUS_TEXT[status];
  const [visible, setVisible] = useState(true);

  // Auto-refresh the page every 4s while processing
  useEffect(() => {
    if (!label) return;
    const id = setInterval(() => {
      window.location.reload();
    }, 4000);
    return () => clearInterval(id);
  }, [label]);

  if (!label || !visible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-violet-700/60 bg-violet-950/50 px-5 py-4 flex items-center gap-4">
      {/* Animated gradient sweep */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "linear-gradient(90deg, transparent 0%, #7C3AED 50%, transparent 100%)",
          animation: "shimmer 2s infinite",
          backgroundSize: "200% 100%",
        }}
      />

      {/* Spinner ring */}
      <svg
        width="22" height="22" viewBox="0 0 22 22"
        className="shrink-0 animate-spin"
        style={{ animationDuration: "0.9s" }}
      >
        <circle cx="11" cy="11" r="9" fill="none" stroke="rgba(124,58,237,0.3)" strokeWidth="2.5"/>
        <path d="M11 2 A9 9 0 0 1 20 11" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-violet-200">{label}</p>
        <p className="text-xs text-violet-400 mt-0.5 flex items-center gap-1">
          Agent processing
          <span className="dot-1 inline-block w-1 h-1 rounded-full bg-violet-400" />
          <span className="dot-2 inline-block w-1 h-1 rounded-full bg-violet-400" />
          <span className="dot-3 inline-block w-1 h-1 rounded-full bg-violet-400" />
        </p>
      </div>

      <button
        onClick={() => setVisible(false)}
        className="shrink-0 text-violet-600 hover:text-violet-300 transition-colors text-lg leading-none"
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}
