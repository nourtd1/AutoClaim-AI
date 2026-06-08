import Link from "next/link";
import type { Claim } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

interface ClaimCardProps {
  claim: Claim;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default function ClaimCard({ claim }: ClaimCardProps) {
  return (
    <Link href={`/claims/${claim.id}`} className="block">
      <div className="glass glass-hover rounded-xl2 p-4 space-y-3 cursor-pointer">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-100 truncate">{claim.claimantName}</p>
            <p className="font-mono-id text-[11px] text-slate-500 mt-0.5">{claim.policyNumber}</p>
          </div>
          <StatusBadge status={claim.status} size="sm" />
        </div>

        {/* Amount + type */}
        <div className="flex items-center justify-between">
          <span className="font-mono-id text-base font-bold text-emerald-400">
            {fmtAmount(claim.claimAmount, claim.currency)}
          </span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {claim.claimType.replace(/_/g, " ")}
          </span>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <PriorityBadge priority={claim.priority} size="sm" />
          <span className="text-[11px] text-slate-500">{fmt(claim.createdAt)}</span>
        </div>

        {/* Stage indicator */}
        <div className="h-0.5 w-full rounded-full bg-slate-800 overflow-hidden">
          {(() => {
            const stages = ["INTAKE","EXTRACTION","VALIDATION","EXCEPTION_ROUTING","HUMAN_REVIEW","RESOLUTION"];
            const idx = stages.indexOf(claim.stage);
            const pct = idx < 0 ? 0 : Math.round(((idx + 1) / stages.length) * 100);
            const color = claim.status === "APPROVED" ? "bg-emerald-500"
              : claim.status === "REJECTED" ? "bg-red-500"
              : claim.status === "ESCALATED" ? "bg-rose-500"
              : "bg-violet-500";
            return <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />;
          })()}
        </div>
      </div>
    </Link>
  );
}
