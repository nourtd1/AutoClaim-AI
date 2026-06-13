import type { ClaimStatus } from "@/lib/types";

interface StatusBadgeProps { status: ClaimStatus; size?: "sm" | "md"; }
type S = { bg:string; border:string; color:string; dot:string; animate?:boolean };

const STYLES: Record<ClaimStatus, S> = {
  SUBMITTED:      { bg:"#F8FAFC", border:"#CBD5E1", color:"#475569", dot:"#94A3B8" },
  EXTRACTING:     { bg:"#EFF6FF", border:"#BFDBFE", color:"#1D4ED8", dot:"#3B82F6", animate:true },
  VALIDATING:     { bg:"#EEF2FF", border:"#C7D2FE", color:"#4338CA", dot:"#6366F1", animate:true },
  PENDING_REVIEW: { bg:"#FFF7ED", border:"#FED7AA", color:"#C2410C", dot:"#F97316" },
  APPROVED:       { bg:"#F0FDF4", border:"#BBF7D0", color:"#15803D", dot:"#22C55E" },
  REJECTED:       { bg:"#FEF2F2", border:"#FECACA", color:"#DC2626", dot:"#EF4444" },
  ESCALATED:      { bg:"#FFF1F2", border:"#FECDD3", color:"#BE123C", dot:"#F43F5E" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = STYLES[status];
  const label = status.replace(/_/g, " ");
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px}`}
      style={{ background:s.bg, borderColor:s.border, color:s.color }}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.animate ? "animate-status-pulse" : ""}`}
        style={{ background:s.dot }} />
      {label}
    </span>
  );
}
