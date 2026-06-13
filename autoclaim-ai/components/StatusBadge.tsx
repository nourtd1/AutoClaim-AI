import type { ClaimStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ClaimStatus;
  size?: "sm" | "md";
}

type S = { bg: string; border: string; color: string; dot: string; animate?: boolean };

const STYLES: Record<ClaimStatus, S> = {
  SUBMITTED:      { bg:"rgba(107,114,128,0.12)",   border:"rgba(107,114,128,0.25)",  color:"#D1D5DB",  dot:"#9CA3AF" },
  EXTRACTING:     { bg:"rgba(59,130,246,0.12)",    border:"rgba(59,130,246,0.3)",    color:"#93C5FD",  dot:"#60A5FA",  animate:true },
  VALIDATING:     { bg:"rgba(168,85,247,0.15)",    border:"rgba(168,85,247,0.35)",   color:"#D8B4FE",  dot:"#A855F7",  animate:true },
  PENDING_REVIEW: { bg:"rgba(245,158,11,0.12)",    border:"rgba(245,158,11,0.3)",    color:"#FCD34D",  dot:"#F59E0B" },
  APPROVED:       { bg:"rgba(16,185,129,0.12)",    border:"rgba(16,185,129,0.3)",    color:"#6EE7B7",  dot:"#10B981" },
  REJECTED:       { bg:"rgba(239,68,68,0.12)",     border:"rgba(239,68,68,0.3)",     color:"#FCA5A5",  dot:"#EF4444" },
  ESCALATED:      { bg:"rgba(236,72,153,0.15)",    border:"rgba(236,72,153,0.35)",   color:"#F9A8D4",  dot:"#EC4899" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = STYLES[status];
  const label = status.replace(/_/g, " ");
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${px}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.animate ? "animate-status-pulse" : ""}`}
        style={{ background: s.dot }}
      />
      {label}
    </span>
  );
}
