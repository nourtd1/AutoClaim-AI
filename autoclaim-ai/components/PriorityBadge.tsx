import type { ClaimPriority } from "@/lib/types";

interface PriorityBadgeProps { priority: ClaimPriority; size?: "sm" | "md"; }
type S = { bg:string; border:string; color:string; dot:string };

const STYLES: Record<ClaimPriority, S> = {
  LOW:      { bg:"#F8FAFC", border:"#CBD5E1", color:"#64748B", dot:"#94A3B8" },
  MEDIUM:   { bg:"#FEFCE8", border:"#FEF08A", color:"#A16207", dot:"#EAB308" },
  HIGH:     { bg:"#FFF7ED", border:"#FED7AA", color:"#C2410C", dot:"#F97316" },
  CRITICAL: { bg:"#FEF2F2", border:"#FECACA", color:"#DC2626", dot:"#EF4444" },
};

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const s = STYLES[priority];
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  const isCritical = priority === "CRITICAL";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px} ${isCritical ? "animate-critical" : ""}`}
      style={{ background:s.bg, borderColor:s.border, color:s.color }}>
      <span className="h-1 w-1 rounded-full shrink-0" style={{ background:s.dot }} />
      {priority}
    </span>
  );
}
