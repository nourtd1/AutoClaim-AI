import type { ClaimPriority } from "@/lib/types";

interface PriorityBadgeProps { priority: ClaimPriority; size?: "sm" | "md" | "lg"; }
type PriorityStyle = { bg: string; border: string; color: string; dot: string };

const STYLES: Record<ClaimPriority, PriorityStyle> = {
  LOW:      { bg: "oklch(0.44 0.009 250 / 0.12)", border: "oklch(0.44 0.009 250 / 0.22)", color: "oklch(0.65 0.012 250)", dot: "oklch(0.44 0.009 250)" },
  MEDIUM:   { bg: "oklch(0.80 0.13 78 / 0.10)",   border: "oklch(0.80 0.13 78 / 0.24)",   color: "oklch(0.88 0.11 78)",   dot: "oklch(0.80 0.13 78)" },
  HIGH:     { bg: "oklch(0.68 0.22 40 / 0.11)",   border: "oklch(0.68 0.22 40 / 0.28)",   color: "oklch(0.78 0.18 40)",   dot: "oklch(0.68 0.22 40)" },
  CRITICAL: { bg: "oklch(0.68 0.22 22 / 0.12)",   border: "oklch(0.68 0.22 22 / 0.32)",   color: "oklch(0.76 0.18 22)",   dot: "oklch(0.68 0.22 22)" },
};

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const s = STYLES[priority];
  const px = size === "sm"
    ? "px-2 py-0.5 text-[10px]"
    : size === "lg"
    ? "px-3 py-1 text-xs"
    : "px-2.5 py-1 text-[11px]";
  const isCritical = priority === "CRITICAL";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px} ${isCritical ? "animate-critical" : ""}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className="h-1 w-1 rounded-full shrink-0" style={{ background: s.dot }} />
      {priority}
    </span>
  );
}
