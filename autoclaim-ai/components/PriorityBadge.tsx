import type { ClaimPriority } from "@/lib/types";

interface PriorityBadgeProps {
  priority: ClaimPriority;
  size?: "sm" | "md";
}

type S = { bg: string; border: string; color: string; dot: string };

const STYLES: Record<ClaimPriority, S> = {
  LOW:      { bg:"rgba(107,114,128,0.1)",   border:"rgba(107,114,128,0.2)",  color:"#9CA3AF",  dot:"#6B7280" },
  MEDIUM:   { bg:"rgba(234,179,8,0.1)",     border:"rgba(234,179,8,0.25)",   color:"#FDE047",  dot:"#EAB308" },
  HIGH:     { bg:"rgba(245,158,11,0.12)",   border:"rgba(245,158,11,0.3)",   color:"#FCD34D",  dot:"#F59E0B" },
  CRITICAL: { bg:"rgba(236,72,153,0.15)",   border:"rgba(236,72,153,0.35)",  color:"#F9A8D4",  dot:"#EC4899" },
};

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const s = STYLES[priority];
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  const isC = priority === "CRITICAL";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${px} ${isC ? "animate-critical" : ""}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      <span className="h-1 w-1 rounded-full shrink-0" style={{ background: s.dot }} />
      {priority}
    </span>
  );
}
