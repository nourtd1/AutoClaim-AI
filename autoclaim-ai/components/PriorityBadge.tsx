import type { ClaimPriority } from "@/lib/types";

interface PriorityBadgeProps {
  priority: ClaimPriority;
  size?: "sm" | "md";
}

const STYLES: Record<ClaimPriority, string> = {
  LOW:      "bg-slate-800  text-slate-400  border-slate-700",
  MEDIUM:   "bg-yellow-950 text-yellow-400 border-yellow-900",
  HIGH:     "bg-orange-950 text-orange-400 border-orange-900",
  CRITICAL: "bg-red-950    text-red-400    border-red-900 animate-critical",
};

export default function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${px} ${STYLES[priority]}`}>
      {priority}
    </span>
  );
}
