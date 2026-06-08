"use client";

import { useEffect, useState } from "react";

interface ConfettiBurstProps {
  trigger: boolean; // fires when changes to true
}

const COLORS = ["#10B981","#7C3AED","#F59E0B","#3B82F6","#EC4899","#6EE7B7"];
const COUNT  = 22;

interface Piece {
  id: number;
  color: string;
  left: string;
  delay: string;
  size: number;
  rotate: number;
}

export default function ConfettiBurst({ trigger }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const next: Piece[] = Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length] ?? "#10B981",
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.5}s`,
      size: 6 + Math.random() * 6,
      rotate: Math.random() * 360,
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 2000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!pieces.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-32 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
