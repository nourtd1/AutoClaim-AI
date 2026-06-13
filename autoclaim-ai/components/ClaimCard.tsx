import Link from "next/link";
import type { Claim } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

interface ClaimCardProps { claim: Claim; }

function fmt(iso:string) { return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}); }
function fmtAmount(amount:number,currency:string) { return new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(amount); }

const STAGE_STEPS = ["INTAKE","EXTRACTION","VALIDATION","EXCEPTION_ROUTING","HUMAN_REVIEW","RESOLUTION"];

const BAR_COLOR: Record<string,string> = {
  APPROVED:"#22C55E", REJECTED:"#EF4444", ESCALATED:"#F43F5E", DEFAULT:"#4F46E5",
};
const AMOUNT_COLOR: Record<string,string> = {
  APPROVED:"#15803D", REJECTED:"#DC2626", ESCALATED:"#BE123C", DEFAULT:"#4338CA",
};

export default function ClaimCard({ claim }: ClaimCardProps) {
  const idx  = STAGE_STEPS.indexOf(claim.stage);
  const pct  = idx < 0 ? 0 : Math.round(((idx+1)/STAGE_STEPS.length)*100);
  const bar  = BAR_COLOR[claim.status]  ?? BAR_COLOR.DEFAULT;
  const amtC = AMOUNT_COLOR[claim.status] ?? AMOUNT_COLOR.DEFAULT;

  return (
    <Link href={`/claims/${claim.id}`} className="block group">
      <div className="claim-card rounded-xl2 p-4 space-y-3.5 cursor-pointer relative overflow-hidden"
        style={{background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        {/* Hover top line */}
        <div className="claim-card-top-line absolute top-0 left-0 right-0 h-0.5"
          style={{background:"linear-gradient(90deg,transparent,#4F46E5,transparent)"}} />

        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{color:"#1E293B"}}>{claim.claimantName}</p>
            <p className="font-mono-id text-[11px] mt-0.5" style={{color:"#94A3B8"}}>{claim.policyNumber}</p>
          </div>
          <StatusBadge status={claim.status} size="sm" />
        </div>

        {/* Amount + type */}
        <div className="flex items-center justify-between">
          <span className="font-mono-id text-base font-bold" style={{color:amtC}}>
            {fmtAmount(claim.claimAmount,claim.currency)}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#64748B"}}>
            {claim.claimType.replace(/_/g," ")}
          </span>
        </div>

        {/* Priority + date */}
        <div className="flex items-center justify-between">
          <PriorityBadge priority={claim.priority} size="sm" />
          <span className="text-[11px] font-mono-id" style={{color:"#94A3B8"}}>{fmt(claim.createdAt)}</span>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="h-1 w-full rounded-full overflow-hidden" style={{background:"#F1F5F9"}}>
            <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:bar}} />
          </div>
          <div className="flex justify-between text-[10px]" style={{color:"#94A3B8"}}>
            <span>INTAKE</span>
            <span>{pct}%</span>
            <span>RESOLUTION</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
