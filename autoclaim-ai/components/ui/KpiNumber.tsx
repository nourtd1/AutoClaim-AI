"use client";

import { useEffect, useRef, useState } from "react";

interface KpiNumberProps {
  value: string | number;
  color: string;
}

function useCountUp(target: number, duration = 700): number {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const startTime = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4); // ease-out-quart
      setDisplay(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export default function KpiNumber({ value, color }: KpiNumberProps) {
  const numeric = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const suffix  = typeof value === "string" ? String(value).replace(/[0-9.]/g, "") : "";
  const isNumeric = !isNaN(numeric) && suffix !== "—";

  const displayed = useCountUp(isNumeric ? numeric : 0);

  return (
    <p className="text-3xl font-bold font-mono-id leading-none tabular-nums" style={{ color }}>
      {isNumeric ? `${displayed}${suffix}` : value}
    </p>
  );
}
