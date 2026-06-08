import type { ClaimStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: ClaimStatus;
  size?: "sm" | "md";
}

type StyleEntry = { base: string; dot?: string; animate?: boolean };

const STATUS_STYLES: Record<ClaimStatus, StyleEntry> = {
  SUBMITTED:      { base: "bg-slate-800 text-slate-300 border-slate-700",     dot: "bg-slate-400" },
  EXTRACTING:     { base: "bg-blue-950  text-blue-300  border-blue-800",      dot: "bg-blue-400",  animate: true },
  VALIDATING:     { base: "bg-violet-950 text-violet-300 border-violet-800",  dot: "bg-violet-400", animate: true },
  PENDING_REVIEW: { base: "bg-orange-950 text-orange-300 border-orange-800",  dot: "bg-orange-400" },
  APPROVED:       { base: "bg-emerald-950 text-emerald-300 border-emerald-800", dot: "bg-emerald-400" },
  REJECTED:       { base: "bg-red-950   text-red-400    border-red-800",      dot: "bg-red-500" },
  ESCALATED:      { base: "bg-rose-950  text-rose-300   border-rose-800",     dot: "bg-rose-400" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = status.replace(/_/g, " ");
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${px} ${style.base}`}>
      {style.dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot} ${style.animate ? "animate-status-pulse" : ""}`}
        />
      )}
      {label}
    </span>
  );
}
