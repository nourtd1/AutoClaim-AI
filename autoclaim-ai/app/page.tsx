import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getAllClaims, getRecentStageEvents, getDb } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import LiveFeed from "./dashboard/LiveFeed";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardStats {
  total:number; approved:number; rejected:number; escalated:number; pending:number;
  avgProcessingTime:number; autoApprovalRate:number;
}

async function fetchStats(): Promise<DashboardStats> {
  await initDb();
  const db = getDb();
  const s = new Date(); s.setHours(0,0,0,0);
  const start = s.toISOString(), end = new Date().toISOString();
  type CR={cnt:number}; type AR={avg_minutes:number|null};

  const [totalR,approvedR,rejectedR,escalatedR,pendingR,avgR] = await Promise.all([
    db.execute({sql:`SELECT COUNT(*) as cnt FROM claims WHERE createdAt>=? AND createdAt<=? AND deletedAt IS NULL`,args:[start,end]}),
    db.execute({sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`,args:[start,end]}),
    db.execute({sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='REJECTED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`,args:[start,end]}),
    db.execute({sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='ESCALATED' AND updatedAt>=? AND updatedAt<=? AND deletedAt IS NULL`,args:[start,end]}),
    db.execute({sql:`SELECT COUNT(*) as cnt FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`,args:[]}),
    db.execute({sql:`SELECT AVG((julianday(resolvedAt)-julianday(createdAt))*1440) as avg_minutes FROM claims WHERE resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`,args:[start,end]}),
  ]);

  const total    = Number((totalR.rows[0]    as unknown as CR).cnt);
  const approved = Number((approvedR.rows[0] as unknown as CR).cnt);
  const rejected = Number((rejectedR.rows[0] as unknown as CR).cnt);
  const escalated= Number((escalatedR.rows[0]as unknown as CR).cnt);
  const pending  = Number((pendingR.rows[0]  as unknown as CR).cnt);
  const avgProcessingTime = Math.round(Number((avgR.rows[0] as unknown as AR).avg_minutes ?? 0));

  const approvedIdsR = await db.execute({sql:`SELECT id FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`,args:[start,end]});
  const approvedIds  = approvedIdsR.rows.map(r => (r as unknown as {id:string}).id);
  let autoApproved   = 0;
  if (approvedIds.length > 0) {
    const humanR = await db.execute({sql:`SELECT COUNT(DISTINCT claimId) as cnt FROM stage_events WHERE actor='HUMAN' AND claimId IN (${approvedIds.map(()=>"?").join(",")})`,args:approvedIds});
    autoApproved = approvedIds.length - Number((humanR.rows[0] as unknown as CR).cnt);
  }
  const autoApprovalRate = approved > 0 ? Math.round((autoApproved/approved)*100) : 0;
  return {total,approved,rejected,escalated,pending,avgProcessingTime,autoApprovalRate};
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiConfig { label:string; value:string|number; sub?:string; tooltip:string; icon:React.ReactNode; delay:string; variant:"indigo"|"green"|"orange"|"rose"; }

function KpiCard({label,value,sub,tooltip,icon,delay,variant}:KpiConfig) {
  const styles = {
    indigo:{ bg:"#EEF2FF", border:"#C7D2FE", iconBg:"#4F46E5", iconColor:"#fff", valueColor:"#4338CA", topLine:"linear-gradient(90deg,transparent,#4F46E5,transparent)" },
    green: { bg:"#F0FDF4", border:"#BBF7D0", iconBg:"#10B981", iconColor:"#fff", valueColor:"#15803D", topLine:"linear-gradient(90deg,transparent,#10B981,transparent)" },
    orange:{ bg:"#FFF7ED", border:"#FED7AA", iconBg:"#F97316", iconColor:"#fff", valueColor:"#C2410C", topLine:"linear-gradient(90deg,transparent,#F97316,transparent)" },
    rose:  { bg:"#FFF1F2", border:"#FECDD3", iconBg:"#F43F5E", iconColor:"#fff", valueColor:"#BE123C", topLine:"linear-gradient(90deg,transparent,#F43F5E,transparent)" },
  }[variant];

  return (
    <div className={`kpi-card kpi-card-${variant === "indigo" ? "purple" : variant === "green" ? "teal" : variant === "orange" ? "amber" : "pink"} rounded-xl2 p-5 space-y-3 relative overflow-hidden animate-fade-up`}
      style={{ background:"#FFFFFF", border:`1px solid ${styles.border}`, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", animationDelay:delay }}
      title={tooltip}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:styles.topLine }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color:"#94A3B8" }}>{label}</p>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background:styles.iconBg }}>
          <span style={{ color:styles.iconColor }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold font-mono-id leading-none" style={{ color:styles.valueColor }}>{value}</p>
        {sub && <p className="text-[11px] mt-1.5" style={{ color:"#94A3B8" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status bars ──────────────────────────────────────────────────────────────

const STATUS_BAR: Record<string, string> = {
  SUBMITTED:"#94A3B8", EXTRACTING:"#3B82F6", VALIDATING:"#6366F1",
  PENDING_REVIEW:"#F97316", APPROVED:"#22C55E", REJECTED:"#EF4444", ESCALATED:"#F43F5E",
};

const ACTOR_META: Record<string, {symbol:string; bg:string; border:string; color:string}> = {
  AGENT:{ symbol:"✦", bg:"#EEF2FF", border:"#C7D2FE", color:"#4F46E5" },
  ROBOT:{ symbol:"◆", bg:"#F0FDFA", border:"#99F6E4", color:"#0D9488" },
  HUMAN:{ symbol:"●", bg:"#FFF7ED", border:"#FED7AA", color:"#C2410C" },
};

function relativeTime(iso:string) {
  const s = Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if (s<60) return `${s}s ago`;
  if (s<3600) return `${Math.floor(s/60)}m ago`;
  if (s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

const IcoDoc  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>;
const IcoBot  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="6" r="2"/></svg>;
const IcoEye  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoClock= () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>;

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  await initDb();
  const [stats,allClaims,recentEvents] = await Promise.all([fetchStats(),getAllClaims(),getRecentStageEvents(6)]);

  const statusCounts: Record<string,number> = {};
  for (const c of allClaims) statusCounts[c.status] = (statusCounts[c.status]??0)+1;
  const maxCount    = Math.max(1,...Object.values(statusCounts));
  const totalClaims = allClaims.length;
  const autoResolvedAll = allClaims.filter(c => c.status==="APPROVED").length;

  const kpis: KpiConfig[] = [
    {label:"Claims Today",    value:stats.total,              sub:"submitted since midnight",        icon:<IcoDoc />,   delay:"0ms",   variant:"indigo", tooltip:"Claims today"},
    {label:"AI Resolved",     value:`${stats.autoApprovalRate}%`, sub:`${stats.approved} approved · ${stats.rejected} rejected`, icon:<IcoBot />,delay:"60ms",  variant:"green",  tooltip:"Auto-resolved by AI"},
    {label:"Pending Review",  value:stats.pending,            sub:"awaiting human decision",         icon:<IcoEye />,   delay:"120ms", variant:"orange", tooltip:"Claims needing review"},
    {label:"Avg. Processing", value:stats.avgProcessingTime>0?`${stats.avgProcessingTime}m`:"—", sub:"intake → resolution", icon:<IcoClock />,delay:"180ms",variant:"rose",tooltip:"Average processing time"},
  ];

  return (
    <div className="min-h-screen" style={{ background:"#F1F5F9" }}>
      <TopBar title="Dashboard" subtitle="Powered by Claude AI & UiPath Maestro" pending={stats.pending} />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* KPIs */}
        <section>
          <p className="text-[11px] uppercase tracking-widest font-semibold mb-4" style={{ color:"#94A3B8" }}>Today&apos;s Overview</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </section>

        {/* Activity + Feed */}
        <div className="grid lg:grid-cols-5 gap-5 animate-fade-up-2">
          {/* Recent Activity */}
          <section className="lg:col-span-2 rounded-xl2 p-5" style={{ background:"#FFFFFF", border:"1px solid #E2E8F0", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color:"#1E293B" }}>Recent Activity</h2>
                <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background:"#4F46E5" }} />
              </div>
              <Link href="/claims" className="text-[11px] font-medium transition-colors" style={{ color:"#4F46E5" }}>View all →</Link>
            </div>
            <ol className="space-y-4">
              {recentEvents.length===0 && (
                <li className="text-xs py-6 text-center" style={{ color:"#94A3B8" }}>No activity yet</li>
              )}
              {recentEvents.map((ev,i) => {
                const actor = ACTOR_META[ev.actor]??{symbol:"·",bg:"#F8FAFC",border:"#E2E8F0",color:"#64748B"};
                return (
                  <li key={ev.id} className="flex items-start gap-3 text-xs animate-fade-up" style={{animationDelay:`${i*40}ms`}}>
                    <div className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{background:actor.bg,border:`1px solid ${actor.border}`,color:actor.color}}>
                      {actor.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug" style={{color:"#1E293B"}}>
                        <span className="font-semibold">{ev.claimantName}</span>
                        <span className="mx-1" style={{color:"#CBD5E1"}}>·</span>
                        <span style={{color:"#64748B"}}>{ev.stage.replace(/_/g," ")}</span>
                      </p>
                      {ev.notes && <p className="truncate mt-0.5 text-[11px]" style={{color:"#94A3B8"}}>{ev.notes}</p>}
                    </div>
                    <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5" style={{color:"#94A3B8"}} suppressHydrationWarning>
                      {relativeTime(ev.timestamp)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Live Feed */}
          <div className="lg:col-span-3"><LiveFeed /></div>
        </div>

        {/* Status + All-time */}
        <div className="grid lg:grid-cols-3 gap-5 animate-fade-up-3">
          <section className="lg:col-span-2 rounded-xl2 p-5" style={{background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{color:"#1E293B"}}>Claims by Status</h2>
              <span className="text-[11px] font-mono-id" style={{color:"#94A3B8"}}>{totalClaims} total</span>
            </div>
            <ul className="space-y-3">
              {(["APPROVED","PENDING_REVIEW","ESCALATED","VALIDATING","EXTRACTING","SUBMITTED","REJECTED"] as ClaimStatus[]).map(st => {
                const count  = statusCounts[st]??0;
                const pct    = Math.round((count/Math.max(1,totalClaims))*100);
                const barPct = Math.round((count/maxCount)*100);
                return (
                  <li key={st}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-medium" style={{color:"#475569"}}>{st.replace(/_/g," ")}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-id" style={{color:"#94A3B8"}}>{pct}%</span>
                        <span className="font-mono-id font-semibold" style={{color:count>0?"#1E293B":"#CBD5E1"}}>{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{background:"#F1F5F9"}}>
                      <div className="h-full rounded-full transition-all duration-700" style={{width:`${barPct}%`,background:STATUS_BAR[st]??"#94A3B8"}} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl2 p-5 flex flex-col" style={{background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <h2 className="text-sm font-semibold mb-5" style={{color:"#1E293B"}}>All-Time</h2>
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-xl" style={{background:"#F0FDF4",border:"1px solid #BBF7D0"}}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{color:"#059669"}}>AI Resolved</p>
                <p className="text-4xl font-bold font-mono-id leading-none" style={{color:"#15803D"}}>{autoResolvedAll}</p>
                <p className="text-[11px] mt-1.5" style={{color:"#86EFAC"}}>claims processed by AI</p>
              </div>
              <div className="p-4 rounded-xl" style={{background:"#EEF2FF",border:"1px solid #C7D2FE"}}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{color:"#4F46E5"}}>Total Claims</p>
                <p className="text-4xl font-bold font-mono-id leading-none" style={{color:"#4338CA"}}>{totalClaims}</p>
                <p className="text-[11px] mt-1.5" style={{color:"#A5B4FC"}}>ever submitted</p>
              </div>
            </div>
            <Link href="/claims" className="mt-5 text-[11px] font-medium" style={{color:"#4F46E5"}}>Browse all claims →</Link>
          </section>
        </div>

        {/* CTAs */}
        <section className="flex flex-wrap gap-3 pb-4 animate-fade-up-4">
          <Link href="/claims/new"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{background:"#4F46E5",border:"1px solid #4338CA",color:"#FFFFFF",boxShadow:"0 2px 8px rgba(79,70,229,0.25)"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Submit New Claim
          </Link>
          <Link href="/review"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{background:"#FFF7ED",border:"1px solid #FED7AA",color:"#C2410C"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review Queue
            {stats.pending>0 && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{background:"#F97316"}}>{stats.pending}</span>}
          </Link>
          <Link href="/claims"
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200"
            style={{background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#475569"}}>
            All Claims
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </section>
      </main>
    </div>
  );
}
