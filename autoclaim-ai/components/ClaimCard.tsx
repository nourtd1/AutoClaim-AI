import Link from "next/link";
import type { Claim } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

interface ClaimCardProps { claim: Claim; }

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });
}
function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style:"currency", currency, maximumFractionDigits:0 }).format(amount);
}

const STAGE_STEPS = ["INTAKE","EXTRACTION","VALIDATION","EXCEPTION_ROUTING","HUMAN_REVIEW","RESOLUTION"];

const BAR_GRAD: Record<string, string> = {
  APPROVED:  "linear-gradient(90deg, #10B981, #34D399)",
  REJECTED:  "linear-gradient(90deg, #EF4444, #F87171)",
  ESCALATED: "linear-gradient(90deg, #EC4899, #F472B6)",
  DEFAULT:   "linear-gradient(90deg, #A855F7, #C084FC)",
};

const AMOUNT_COLOR: Record<string, string> = {
  APPROVED:  "#6EE7B7",
  REJECTED:  "#FCA5A5",
  ESCALATED: "#F9A8D4",
  DEFAULT:   "#E9D5FF",
};

export default function ClaimCard({ claim }: ClaimCardProps) {
  const idx = STAGE_STEPS.indexOf(claim.stage);
  const pct = idx < 0 ? 0 : Math.round(((idx + 1) / STAGE_STEPS.length) * 100);
  const bar  = BAR_GRAD[claim.status] ?? BAR_GRAD.DEFAULT;
  const amtC = AMOUNT_COLOR[claim.status] ?? AMOUNT_COLOR.DEFAULT;

  return (
    <Link href={`/claims/${claim.id}`} className="block group">
      <div
        className="claim-card rounded-xl2 p-4 space-y-3.5 cursor-pointer relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(124,58,237,0.04) 100%)",
          border: "1px solid rgba(168,85,247,0.18)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Hover edge top line */}
        <div className="claim-card-top-line absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)" }} />

        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate transition-colors" style={{ color: "#FAF5FF" }}>{claim.claimantName}</p>
            <p className="font-mono-id text-[11px] mt-0.5 tracking-wide" style={{ color: "rgba(168,85,247,0.4)" }}>{claim.policyNumber}</p>
          </div>
          <StatusBadge status={claim.status} size="sm" />
        </div>

        {/* Amount + type */}
        <div className="flex items-center justify-between">
          <span className="font-mono-id text-base font-bold leading-none" style={{ color: amtC }}>
            {fmtAmount(claim.claimAmount, claim.currency)}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.18)", color: "rgba(228,216,255,0.55)" }}>
            {claim.claimType.replace(/_/g," ")}
          </span>
        </div>

        {/* Priority + date */}
        <div className="flex items-center justify-between">
          <PriorityBadge priority={claim.priority} size="sm" />
          <span className="text-[11px] font-mono-id" style={{ color: "rgba(168,85,247,0.35)" }}>{fmt(claim.createdAt)}</span>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(168,85,247,0.1)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: bar }} />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: "rgba(168,85,247,0.3)" }}>
            <span>INTAKE</span>
            <span style={{ color: "rgba(168,85,247,0.5)" }}>{pct}%</span>
            <span>RESOLUTION</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
