import type { ClaimPriority } from "@/lib/types";

interface PriorityBadgeProps { priority: ClaimPriority; size?: "sm" | "md"; }
type S = { bg: string; border: string; color: string; dot: string };

const STYLES: Record<ClaimPriority, S> = {
  LOW:      { bg: "rgba(74,85,104,0.12)",   border: "rgba(74,85,104,0.25)",  color: "#8B95B0", dot: "#4A5568" },
  MEDIUM:   { bg: "rgba(234,179,8,0.1)",    border: "rgba(234,179,8,0.25)",  color: "#FCD34D", dot: "#EAB308" },
  HIGH:     { bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)", color: "#FB923C", dot: "#F97316" },
  CRITICAL: { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",   color: "#F87171", dot: "#EF4444" },
};

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const s = STYLES[priority];
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  const isCritical = priority === "CRITICAL";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px} ${isCritical ? "animate-critical" : ""}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className="h-1 w-1 rounded-full shrink-0" style={{ background: s.dot }} />
      {priority}
    </span>
  );
}
