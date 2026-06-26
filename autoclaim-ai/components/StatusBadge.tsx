import type { ClaimStatus } from "@/lib/types";

interface StatusBadgeProps { status: ClaimStatus; size?: "sm" | "md"; }
type S = { bg: string; border: string; color: string; dot: string; animate?: boolean };

const STYLES: Record<ClaimStatus, S> = {
  SUBMITTED:      { bg: "rgba(74,85,104,0.15)",   border: "rgba(74,85,104,0.3)",   color: "#8B95B0", dot: "#4A5568" },
  EXTRACTING:     { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)", color: "#60A5FA", dot: "#3B82F6", animate: true },
  VALIDATING:     { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)", color: "#818CF8", dot: "#6366F1", animate: true },
  PENDING_REVIEW: { bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)", color: "#FB923C", dot: "#F97316" },
  APPROVED:       { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.25)", color: "#34D399", dot: "#10B981" },
  REJECTED:       { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",  color: "#F87171", dot: "#EF4444" },
  ESCALATED:      { bg: "rgba(244,63,94,0.12)",   border: "rgba(244,63,94,0.25)",  color: "#FB7185", dot: "#F43F5E" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = STYLES[status];
  const label = status.replace(/_/g, " ");
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.animate ? "animate-status-pulse" : ""}`}
        style={{ background: s.dot }} />
      {label}
    </span>
  );
}
