import Link from "next/link";
import type { Claim } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

interface ClaimCardProps { claim: Claim; }

function fmt(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }); }
function fmtAmount(amount: number, currency: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount); }

const STAGE_STEPS = ["INTAKE", "EXTRACTION", "VALIDATION", "EXCEPTION_ROUTING", "HUMAN_REVIEW", "RESOLUTION"];

const BAR_COLOR: Record<string, string> = {
  APPROVED: "#10B981", REJECTED: "#EF4444", ESCALATED: "#F43F5E", DEFAULT: "#6366F1",
};
const AMOUNT_COLOR: Record<string, string> = {
  APPROVED: "#34D399", REJECTED: "#F87171", ESCALATED: "#FB7185", DEFAULT: "#818CF8",
};

export default function ClaimCard({ claim }: ClaimCardProps) {
  const idx  = STAGE_STEPS.indexOf(claim.stage);
  const pct  = idx < 0 ? 0 : Math.round(((idx + 1) / STAGE_STEPS.length) * 100);
  const bar  = BAR_COLOR[claim.status]  ?? BAR_COLOR.DEFAULT;
  const amtC = AMOUNT_COLOR[claim.status] ?? AMOUNT_COLOR.DEFAULT;

  return (
    <Link href={`/claims/${claim.id}`} className="block group">
      <div className="claim-card rounded-xl2 p-4 space-y-3.5 relative overflow-hidden">
        {/* Hover top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)" }} />

        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "#E8EBF4" }}>{claim.claimantName}</p>
            <p className="font-mono-id text-[11px] mt-0.5" style={{ color: "#4A5568" }}>{claim.policyNumber}</p>
          </div>
          <StatusBadge status={claim.status} size="sm" />
        </div>

        {/* Amount + type */}
        <div className="flex items-center justify-between">
          <span className="font-mono-id text-base font-bold tabular-nums" style={{ color: amtC }}>
            {fmtAmount(claim.claimAmount, claim.currency)}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#8B95B0" }}>
            {claim.claimType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Priority + date */}
        <div className="flex items-center justify-between">
          <PriorityBadge priority={claim.priority} size="sm" />
          <span className="text-[11px] font-mono-id tabular-nums" style={{ color: "#4A5568" }}>{fmt(claim.createdAt)}</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full animate-bar" style={{ width: `${pct}%`, background: bar, boxShadow: pct > 0 ? `0 0 6px ${bar}50` : "none" }} />
          </div>
          <div className="flex justify-between text-[10px] font-mono-id" style={{ color: "#3A4155" }}>
            <span>INTAKE</span>
            <span style={{ color: pct > 0 ? bar : "#3A4155" }}>{pct}%</span>
            <span>RESOLUTION</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
