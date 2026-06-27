import type { ClaimStatus } from "@/lib/types";

interface StatusBadgeProps { status: ClaimStatus; size?: "sm" | "md" | "lg"; }
type StatusStyle = { bg: string; border: string; color: string; dot: string; animate?: boolean };

const STYLES: Record<ClaimStatus, StatusStyle> = {
  SUBMITTED:      { bg: "oklch(0.44 0.009 250 / 0.14)", border: "oklch(0.44 0.009 250 / 0.28)", color: "oklch(0.65 0.012 250)", dot: "oklch(0.44 0.009 250)" },
  EXTRACTING:     { bg: "oklch(0.68 0.18 232 / 0.12)",  border: "oklch(0.68 0.18 232 / 0.28)",  color: "oklch(0.78 0.15 232)",  dot: "oklch(0.68 0.18 232)", animate: true },
  VALIDATING:     { bg: "oklch(0.70 0.17 155 / 0.11)",  border: "oklch(0.70 0.17 155 / 0.28)",  color: "oklch(0.80 0.15 155)",  dot: "oklch(0.70 0.17 155)", animate: true },
  PENDING_REVIEW: { bg: "oklch(0.80 0.13 78 / 0.11)",   border: "oklch(0.80 0.13 78 / 0.28)",   color: "oklch(0.88 0.11 78)",   dot: "oklch(0.80 0.13 78)" },
  APPROVED:       { bg: "oklch(0.70 0.17 155 / 0.11)",  border: "oklch(0.70 0.17 155 / 0.28)",  color: "oklch(0.80 0.15 155)",  dot: "oklch(0.70 0.17 155)" },
  REJECTED:       { bg: "oklch(0.68 0.22 22 / 0.10)",   border: "oklch(0.68 0.22 22 / 0.28)",   color: "oklch(0.76 0.18 22)",   dot: "oklch(0.68 0.22 22)" },
  ESCALATED:      { bg: "oklch(0.70 0.19 12 / 0.10)",   border: "oklch(0.70 0.19 12 / 0.28)",   color: "oklch(0.78 0.15 12)",   dot: "oklch(0.70 0.19 12)" },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const s = STYLES[status];
  const label = status.replace(/_/g, " ");
  const px = size === "sm"
    ? "px-2 py-0.5 text-[10px]"
    : size === "lg"
    ? "px-3 py-1 text-xs"
    : "px-2.5 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${px}`}
      style={{ background: s.bg, borderColor: s.border, color: s.color }}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${s.animate ? "animate-status-pulse" : ""}`}
        style={{ background: s.dot }} />
      {label}
    </span>
  );
}
