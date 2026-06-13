import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getAllClaims, getRecentStageEvents, getDb } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import LiveFeed from "./dashboard/LiveFeed";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardStats {
  total: number; approved: number; rejected: number;
  escalated: number; pending: number;
  avgProcessingTime: number; autoApprovalRate: number;
}

async function fetchStats(): Promise<DashboardStats> {
  await initDb();
  const db = getDb();
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const start = s.toISOString(), end = new Date().toISOString();

  type CR = { cnt: number }; type AR = { avg_minutes: number | null };

  const [totalR, approvedR, rejectedR, escalatedR, pendingR, avgR] = await Promise.all([
    db.execute({ sql:`SELECT COUNT(*) as cnt FROM claims WHERE createdAt>=? AND createdAt<=? AND deletedAt IS NULL`, args:[start,end] }),
    db.execute({ sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args:[start,end] }),
    db.execute({ sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='REJECTED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args:[start,end] }),
    db.execute({ sql:`SELECT COUNT(*) as cnt FROM claims WHERE status='ESCALATED' AND updatedAt>=? AND updatedAt<=? AND deletedAt IS NULL`, args:[start,end] }),
    db.execute({ sql:`SELECT COUNT(*) as cnt FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`, args:[] }),
    db.execute({ sql:`SELECT AVG((julianday(resolvedAt)-julianday(createdAt))*1440) as avg_minutes FROM claims WHERE resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args:[start,end] }),
  ]);

  const total    = Number((totalR.rows[0] as unknown as CR).cnt);
  const approved = Number((approvedR.rows[0] as unknown as CR).cnt);
  const rejected = Number((rejectedR.rows[0] as unknown as CR).cnt);
  const escalated= Number((escalatedR.rows[0] as unknown as CR).cnt);
  const pending  = Number((pendingR.rows[0] as unknown as CR).cnt);
  const avgProcessingTime = Math.round(Number((avgR.rows[0] as unknown as AR).avg_minutes ?? 0));

  const approvedIdsR = await db.execute({ sql:`SELECT id FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args:[start,end] });
  const approvedIds = approvedIdsR.rows.map(r => (r as unknown as {id:string}).id);

  let autoApproved = 0;
  if (approvedIds.length > 0) {
    const humanR = await db.execute({ sql:`SELECT COUNT(DISTINCT claimId) as cnt FROM stage_events WHERE actor='HUMAN' AND claimId IN (${approvedIds.map(()=>"?").join(",")})`, args:approvedIds });
    autoApproved = approvedIds.length - Number((humanR.rows[0] as unknown as CR).cnt);
  }
  const autoApprovalRate = approved > 0 ? Math.round((autoApproved/approved)*100) : 0;
  return { total, approved, rejected, escalated, pending, avgProcessingTime, autoApprovalRate };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiConfig {
  label: string;
  value: string | number;
  sub?: string;
  tooltip: string;
  icon: React.ReactNode;
  delay: string;
  variant: "purple" | "pink" | "amber" | "teal";
}

function KpiCard({ label, value, sub, tooltip, icon, delay, variant }: KpiConfig) {
  const styles = {
    purple: {
      card: "rgba(168,85,247,0.08)",
      border: "rgba(168,85,247,0.25)",
      borderHover: "rgba(168,85,247,0.45)",
      iconBg: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(124,58,237,0.15))",
      iconBorder: "rgba(168,85,247,0.3)",
      iconColor: "#C084FC",
      topLine: "linear-gradient(90deg, transparent, #A855F7, transparent)",
      valueGlow: "0 0 20px rgba(168,85,247,0.5)",
      valueColor: "#E9D5FF",
    },
    pink: {
      card: "rgba(236,72,153,0.07)",
      border: "rgba(236,72,153,0.22)",
      borderHover: "rgba(236,72,153,0.42)",
      iconBg: "linear-gradient(135deg, rgba(236,72,153,0.25), rgba(190,24,93,0.15))",
      iconBorder: "rgba(236,72,153,0.3)",
      iconColor: "#F9A8D4",
      topLine: "linear-gradient(90deg, transparent, #EC4899, transparent)",
      valueGlow: "0 0 20px rgba(236,72,153,0.5)",
      valueColor: "#FDF2F8",
    },
    amber: {
      card: "rgba(245,158,11,0.06)",
      border: "rgba(245,158,11,0.2)",
      borderHover: "rgba(245,158,11,0.4)",
      iconBg: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(180,83,9,0.1))",
      iconBorder: "rgba(245,158,11,0.25)",
      iconColor: "#FCD34D",
      topLine: "linear-gradient(90deg, transparent, #F59E0B, transparent)",
      valueGlow: "0 0 16px rgba(245,158,11,0.4)",
      valueColor: "#FEF3C7",
    },
    teal: {
      card: "rgba(20,184,166,0.06)",
      border: "rgba(20,184,166,0.2)",
      borderHover: "rgba(20,184,166,0.38)",
      iconBg: "linear-gradient(135deg, rgba(20,184,166,0.2), rgba(13,148,136,0.1))",
      iconBorder: "rgba(20,184,166,0.25)",
      iconColor: "#5EEAD4",
      topLine: "linear-gradient(90deg, transparent, #14B8A6, transparent)",
      valueGlow: "0 0 16px rgba(20,184,166,0.4)",
      valueColor: "#CCFBF1",
    },
  }[variant];

  return (
    <div
      className={`kpi-card kpi-card-${variant} rounded-xl2 p-5 space-y-4 relative overflow-hidden cursor-default animate-fade-up`}
      style={{
        background: styles.card,
        border: `1px solid ${styles.border}`,
        backdropFilter: "blur(24px)",
        animationDelay: delay,
      }}
      title={tooltip}
    >
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: styles.topLine }} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "rgba(228,216,255,0.5)" }}>{label}</p>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: styles.iconBg, border: `1px solid ${styles.iconBorder}`, color: styles.iconColor }}>
          {icon}
        </div>
      </div>

      <div>
        <p className="text-3xl font-bold font-mono-id leading-none" style={{ color: styles.valueColor, textShadow: styles.valueGlow }}>
          {value}
        </p>
        {sub && <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "rgba(228,216,255,0.4)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status bars ──────────────────────────────────────────────────────────────

const STATUS_BAR: Record<string, string> = {
  SUBMITTED:      "linear-gradient(90deg, #6B7280, #9CA3AF)",
  EXTRACTING:     "linear-gradient(90deg, #3B82F6, #60A5FA)",
  VALIDATING:     "linear-gradient(90deg, #A855F7, #C084FC)",
  PENDING_REVIEW: "linear-gradient(90deg, #F59E0B, #FCD34D)",
  APPROVED:       "linear-gradient(90deg, #10B981, #34D399)",
  REJECTED:       "linear-gradient(90deg, #EF4444, #F87171)",
  ESCALATED:      "linear-gradient(90deg, #EC4899, #F9A8D4)",
};

const ACTOR_META: Record<string, { symbol: string; color: string; bg: string; border: string }> = {
  AGENT: { symbol: "✦", color: "#C084FC", bg: "rgba(168,85,247,0.15)", border: "rgba(168,85,247,0.3)" },
  ROBOT: { symbol: "◆", color: "#5EEAD4", bg: "rgba(20,184,166,0.15)", border: "rgba(20,184,166,0.3)" },
  HUMAN: { symbol: "●", color: "#FCD34D", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)" },
};

function relativeTime(iso: string) {
  const s = Math.floor((Date.now()-new Date(iso).getTime())/1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ── Icons ────────────────────────────────────────────────────────────────────

const IcoDoc  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>;
const IcoBot  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="6" r="2"/></svg>;
const IcoEye  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoClock= () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>;

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  await initDb();
  const [stats, allClaims, recentEvents] = await Promise.all([fetchStats(), getAllClaims(), getRecentStageEvents(6)]);
  const statusCounts: Record<string, number> = {};
  for (const c of allClaims) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const maxCount = Math.max(1, ...Object.values(statusCounts));
  const totalClaims = allClaims.length;
  const autoResolvedAll = allClaims.filter(c => c.status === "APPROVED").length;

  const kpis: KpiConfig[] = [
    { label: "Claims Today",    value: stats.total,            sub: "submitted since midnight",          icon: <IcoDoc />,   delay: "0ms",   variant: "purple", tooltip: "Claims created today" },
    { label: "AI Resolved",     value: `${stats.autoApprovalRate}%`, sub: `${stats.approved} approved · ${stats.rejected} rejected`, icon: <IcoBot />,   delay: "60ms",  variant: "pink",   tooltip: "Auto-resolved by AI today" },
    { label: "Pending Review",  value: stats.pending,          sub: "awaiting human decision",          icon: <IcoEye />,   delay: "120ms", variant: "amber",  tooltip: "Claims requiring human review" },
    { label: "Avg. Processing", value: stats.avgProcessingTime > 0 ? `${stats.avgProcessingTime}m` : "—", sub: "intake → resolution", icon: <IcoClock />, delay: "180ms", variant: "teal",   tooltip: "Average processing time today" },
  ];

  const CARD_STYLE = {
    background: "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(124,58,237,0.04) 100%)",
    border: "1px solid rgba(168,85,247,0.18)",
    backdropFilter: "blur(24px)",
  };

  return (
    <div className="min-h-screen">
      <TopBar
        title="Dashboard"
        subtitle="Powered by Claude AI & UiPath Maestro"
        pending={stats.pending}
      />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">

        {/* ── KPIs ── */}
        <section>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-4" style={{ color: "rgba(168,85,247,0.45)" }}>
            Today&apos;s Overview
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </section>

        {/* ── Activity + Feed ── */}
        <div className="grid lg:grid-cols-5 gap-5 animate-fade-up-2">
          {/* Recent Activity */}
          <section className="lg:col-span-2 rounded-xl2 p-5" style={CARD_STYLE}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: "#FAF5FF" }}>Recent Activity</h2>
                <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background: "#A855F7" }} />
              </div>
              <Link href="/claims" className="text-[11px] font-medium transition-colors"
                style={{ color: "#A855F7" }}>View all →</Link>
            </div>
            <ol className="space-y-4">
              {recentEvents.length === 0 && (
                <li className="text-xs py-6 text-center" style={{ color: "rgba(168,85,247,0.35)" }}>No activity yet</li>
              )}
              {recentEvents.map((ev, i) => {
                const actor = ACTOR_META[ev.actor] ?? { symbol: "·", color: "#6B7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)" };
                return (
                  <li key={ev.id} className="flex items-start gap-3 text-xs animate-fade-up" style={{ animationDelay: `${i*40}ms` }}>
                    <div className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{ background: actor.bg, border: `1px solid ${actor.border}`, color: actor.color }}>
                      {actor.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug" style={{ color: "#E9D5FF" }}>
                        <span className="font-semibold">{ev.claimantName}</span>
                        <span className="mx-1" style={{ color: "rgba(168,85,247,0.3)" }}>·</span>
                        <span style={{ color: "rgba(228,216,255,0.45)" }}>{ev.stage.replace(/_/g," ")}</span>
                      </p>
                      {ev.notes && <p className="truncate mt-0.5 text-[11px]" style={{ color: "rgba(168,85,247,0.35)" }}>{ev.notes}</p>}
                    </div>
                    <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5" style={{ color: "rgba(168,85,247,0.3)" }} suppressHydrationWarning>
                      {relativeTime(ev.timestamp)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Live Feed */}
          <div className="lg:col-span-3">
            <LiveFeed />
          </div>
        </div>

        {/* ── Status + All-time ── */}
        <div className="grid lg:grid-cols-3 gap-5 animate-fade-up-3">
          <section className="lg:col-span-2 rounded-xl2 p-5" style={CARD_STYLE}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: "#FAF5FF" }}>Claims by Status</h2>
              <span className="text-[11px] font-mono-id" style={{ color: "rgba(168,85,247,0.45)" }}>{totalClaims} total</span>
            </div>
            <ul className="space-y-3">
              {(["APPROVED","PENDING_REVIEW","ESCALATED","VALIDATING","EXTRACTING","SUBMITTED","REJECTED"] as ClaimStatus[]).map(st => {
                const count = statusCounts[st] ?? 0;
                const pct   = Math.round((count/Math.max(1,totalClaims))*100);
                const barPct= Math.round((count/maxCount)*100);
                return (
                  <li key={st} className="group">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-medium" style={{ color: "rgba(228,216,255,0.55)" }}>{st.replace(/_/g," ")}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-id" style={{ color: "rgba(168,85,247,0.4)" }}>{pct}%</span>
                        <span className="font-mono-id font-semibold" style={{ color: count > 0 ? "#E9D5FF" : "rgba(168,85,247,0.25)" }}>{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(168,85,247,0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${barPct}%`, background: STATUS_BAR[st] ?? "linear-gradient(90deg,#6B7280,#9CA3AF)" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl2 p-5 flex flex-col" style={CARD_STYLE}>
            <h2 className="text-sm font-semibold mb-5" style={{ color: "#FAF5FF" }}>All-Time</h2>
            <div className="space-y-4 flex-1">
              <div className="p-4 rounded-xl" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(168,85,247,0.6)" }}>AI Resolved</p>
                <p className="text-4xl font-bold font-mono-id leading-none" style={{ color: "#E9D5FF", textShadow: "0 0 20px rgba(168,85,247,0.5)" }}>{autoResolvedAll}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(168,85,247,0.45)" }}>claims processed by AI</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: "rgba(236,72,153,0.07)", border: "1px solid rgba(236,72,153,0.18)" }}>
                <p className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: "rgba(236,72,153,0.6)" }}>Total Claims</p>
                <p className="text-4xl font-bold font-mono-id leading-none" style={{ color: "#FDF2F8", textShadow: "0 0 20px rgba(236,72,153,0.4)" }}>{totalClaims}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(236,72,153,0.4)" }}>ever submitted</p>
              </div>
            </div>
            <Link href="/claims" className="mt-5 text-[11px] font-medium transition-colors"
              style={{ color: "rgba(168,85,247,0.45)" }}>Browse all claims →</Link>
          </section>
        </div>

        {/* ── CTAs ── */}
        <section className="flex flex-wrap gap-3 pb-4 animate-fade-up-4">
          <Link href="/claims/new"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.12))", border: "1px solid rgba(168,85,247,0.3)", color: "#C084FC" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Submit New Claim
          </Link>
          <Link href="/review"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{ background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)", color: "#F9A8D4" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review Queue
            {stats.pending > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #EC4899, #DB2777)" }}>{stats.pending}</span>
            )}
          </Link>
          <Link href="/claims"
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200"
            style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)", color: "rgba(196,181,253,0.6)" }}>
            All Claims
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </section>
      </main>
    </div>
  );
}
