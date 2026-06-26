"use client";

import { useEffect, useRef, useState } from "react";

interface LiveCounterProps {
  value: number;
  label: string;
  color?: string; // Tailwind text color class e.g. "text-emerald-400"
  size?: "sm" | "md" | "lg";
}

function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export default function LiveCounter({
  value,
  label,
  color = "text-emerald-400",
  size = "md",
}: LiveCounterProps) {
  const displayed = useCountUp(value);

  const numClass = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl",
  }[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-mono-id font-bold tabular-nums ${numClass}`} style={{ color }}>
        {displayed}
      </span>
      <span className="text-[10px] uppercase tracking-widest font-medium text-center" style={{ color: "rgba(74,85,104,0.9)" }}>
        {label}
      </span>
    </div>
  );
}
