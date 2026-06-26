import Link from "next/link";
import type { Claim } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

interface ClaimCardProps { claim: Claim; }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const STAGE_STEPS = ["INTAKE", "EXTRACTION", "VALIDATION", "EXCEPTION_ROUTING", "HUMAN_REVIEW", "RESOLUTION"];

const BAR_COLOR: Record<string, string> = {
  APPROVED: "oklch(0.72 0.18 142)",
  REJECTED: "oklch(0.68 0.22 22)",
  ESCALATED: "oklch(0.70 0.19 12)",
  DEFAULT: "oklch(0.72 0.18 142 / 0.60)",
};
const AMOUNT_COLOR: Record<string, string> = {
  APPROVED: "oklch(0.82 0.16 142)",
  REJECTED: "oklch(0.76 0.18 22)",
  ESCALATED: "oklch(0.78 0.15 12)",
  DEFAULT: "oklch(0.72 0.18 142 / 0.80)",
};

export default function ClaimCard({ claim }: ClaimCardProps) {
  const idx  = STAGE_STEPS.indexOf(claim.stage);
  const pct  = idx < 0 ? 0 : Math.round(((idx + 1) / STAGE_STEPS.length) * 100);
  const bar  = BAR_COLOR[claim.status]  ?? BAR_COLOR.DEFAULT;
  const amtC = AMOUNT_COLOR[claim.status] ?? AMOUNT_COLOR.DEFAULT;

  return (
    <Link href={`/claims/${claim.id}`} className="block group">
      <div className="claim-card rounded-xl p-4 space-y-3.5 relative overflow-hidden">
        {/* Top glow line on hover */}
        <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.72 0.18 142 / 0.50), transparent)" }} />

        {/* Claimant + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "oklch(0.93 0.005 140)" }}>
              {claim.claimantName}
            </p>
            <p className="font-mono-id text-[11px] mt-0.5" style={{ color: "oklch(0.35 0.005 140)" }}>
              {claim.policyNumber}
            </p>
          </div>
          <StatusBadge status={claim.status} size="sm" />
        </div>

        {/* Amount + type */}
        <div className="flex items-center justify-between">
          <span className="font-mono-id text-base font-bold tabular-nums" style={{ color: amtC }}>
            {fmtAmount(claim.claimAmount, claim.currency)}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full"
            style={{
              background: "oklch(1.00 0.000 0 / 0.04)",
              border: "1px solid oklch(1.00 0.000 0 / 0.08)",
              color: "oklch(0.55 0.008 140)",
            }}>
            {claim.claimType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Priority + date */}
        <div className="flex items-center justify-between">
          <PriorityBadge priority={claim.priority} size="sm" />
          <span className="text-[11px] font-mono-id tabular-nums" style={{ color: "oklch(0.35 0.005 140)" }}>
            {fmt(claim.createdAt)}
          </span>
        </div>

        {/* Stage progress */}
        <div className="space-y-1.5">
          <div className="h-px w-full rounded-full overflow-hidden" style={{ background: "oklch(1.00 0.000 0 / 0.10)" }}>
            <div className="h-full rounded-full animate-bar"
              style={{
                width: `${pct}%`,
                background: bar,
                boxShadow: pct > 0 ? `0 0 6px ${bar}` : "none",
              }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono-id" style={{ color: "oklch(0.30 0.004 140)" }}>
            <span>INTAKE</span>
            <span style={{ color: pct > 0 ? bar : "oklch(0.30 0.004 140)" }}>{pct}%</span>
            <span>RESOLUTION</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
