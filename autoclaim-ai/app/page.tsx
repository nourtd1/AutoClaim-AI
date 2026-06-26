import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getAllClaims, getRecentStageEvents, getDb } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import LiveFeed from "./dashboard/LiveFeed";
import TopBar from "@/components/TopBar";
import KpiNumber from "@/components/ui/KpiNumber";

export const metadata: Metadata = { title: "Dashboard" };

interface DashboardStats {
  total: number; approved: number; rejected: number; escalated: number; pending: number;
  avgProcessingTime: number; autoApprovalRate: number;
}

async function fetchStats(): Promise<DashboardStats> {
  await initDb();
  const db = getDb();
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const start = s.toISOString(), end = new Date().toISOString();
  type CR = { cnt: number }; type AR = { avg_minutes: number | null };

  const [totalR, approvedR, rejectedR, escalatedR, pendingR, avgR] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE createdAt>=? AND createdAt<=? AND deletedAt IS NULL`, args: [start, end] }),
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [start, end] }),
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='REJECTED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [start, end] }),
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status='ESCALATED' AND updatedAt>=? AND updatedAt<=? AND deletedAt IS NULL`, args: [start, end] }),
    db.execute({ sql: `SELECT COUNT(*) as cnt FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`, args: [] }),
    db.execute({ sql: `SELECT AVG((julianday(resolvedAt)-julianday(createdAt))*1440) as avg_minutes FROM claims WHERE resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [start, end] }),
  ]);

  const total     = Number((totalR.rows[0]     as unknown as CR).cnt);
  const approved  = Number((approvedR.rows[0]  as unknown as CR).cnt);
  const rejected  = Number((rejectedR.rows[0]  as unknown as CR).cnt);
  const escalated = Number((escalatedR.rows[0] as unknown as CR).cnt);
  const pending   = Number((pendingR.rows[0]   as unknown as CR).cnt);
  const avgProcessingTime = Math.round(Number((avgR.rows[0] as unknown as AR).avg_minutes ?? 0));

  const approvedIdsR = await db.execute({ sql: `SELECT id FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`, args: [start, end] });
  const approvedIds  = approvedIdsR.rows.map(r => (r as unknown as { id: string }).id);
  let autoApproved   = 0;
  if (approvedIds.length > 0) {
    const humanR = await db.execute({ sql: `SELECT COUNT(DISTINCT claimId) as cnt FROM stage_events WHERE actor='HUMAN' AND claimId IN (${approvedIds.map(() => "?").join(",")})`, args: approvedIds });
    autoApproved = approvedIds.length - Number((humanR.rows[0] as unknown as CR).cnt);
  }
  const autoApprovalRate = approved > 0 ? Math.round((autoApproved / approved) * 100) : 0;
  return { total, approved, rejected, escalated, pending, avgProcessingTime, autoApprovalRate };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiConfig { label: string; value: string | number; sub?: string; tooltip: string; icon: React.ReactNode; delay: string; variant: "indigo" | "emerald" | "orange" | "rose"; }

const KPI_STYLES = {
  indigo:  { accent: "#6366F1", accentDim: "rgba(99,102,241,0.12)",  accentBorder: "rgba(99,102,241,0.25)",  iconBg: "rgba(99,102,241,0.2)",  iconColor: "#818CF8", valueColor: "#818CF8" },
  emerald: { accent: "#10B981", accentDim: "rgba(16,185,129,0.1)",   accentBorder: "rgba(16,185,129,0.2)",   iconBg: "rgba(16,185,129,0.15)", iconColor: "#34D399", valueColor: "#34D399" },
  orange:  { accent: "#F97316", accentDim: "rgba(249,115,22,0.1)",   accentBorder: "rgba(249,115,22,0.2)",   iconBg: "rgba(249,115,22,0.15)", iconColor: "#FB923C", valueColor: "#FB923C" },
  rose:    { accent: "#F43F5E", accentDim: "rgba(244,63,94,0.1)",    accentBorder: "rgba(244,63,94,0.2)",    iconBg: "rgba(244,63,94,0.15)",  iconColor: "#FB7185", valueColor: "#FB7185" },
} as const;

function KpiCard({ label, value, sub, tooltip, icon, delay, variant }: KpiConfig) {
  const s = KPI_STYLES[variant];
  return (
    <div
      className={`kpi-card kpi-card-${variant} rounded-xl2 p-5 space-y-3.5 relative overflow-hidden animate-fade-up`}
      style={{ animationDelay: delay }}
      title={tooltip}>
      {/* Top accent line */}
      <div className="absolute top-0 left-8 right-8 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${s.accent}, transparent)`, opacity: 0.5 }} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide" style={{ color: "rgba(139,149,176,0.7)" }}>{label}</p>
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: s.iconBg, border: `1px solid ${s.accentBorder}` }}>
          <span style={{ color: s.iconColor }}>{icon}</span>
        </div>
      </div>

      <div>
        <KpiNumber value={value} color={s.valueColor} />
        {sub && <p className="text-[11px] mt-1.5" style={{ color: "rgba(74,85,104,0.9)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_BAR: Record<string, string> = {
  SUBMITTED: "#4A5568", EXTRACTING: "#3B82F6", VALIDATING: "#6366F1",
  PENDING_REVIEW: "#F97316", APPROVED: "#10B981", REJECTED: "#EF4444", ESCALATED: "#F43F5E",
};

const ACTOR_META: Record<string, { symbol: string; bg: string; border: string; color: string }> = {
  AGENT: { symbol: "✦", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.25)",  color: "#818CF8" },
  ROBOT: { symbol: "◆", bg: "rgba(13,148,136,0.12)",  border: "rgba(13,148,136,0.25)",  color: "#2DD4BF" },
  HUMAN: { symbol: "●", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.25)",  color: "#FB923C" },
};

function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const IcoDoc   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>;
const IcoBot   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="6" r="2"/></svg>;
const IcoEye   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoClock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>;

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  await initDb();
  const [stats, allClaims, recentEvents] = await Promise.all([fetchStats(), getAllClaims(), getRecentStageEvents(6)]);

  const statusCounts: Record<string, number> = {};
  for (const c of allClaims) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const maxCount    = Math.max(1, ...Object.values(statusCounts));
  const totalClaims = allClaims.length;
  const autoResolvedAll = allClaims.filter(c => c.status === "APPROVED").length;

  const kpis: KpiConfig[] = [
    { label: "Claims Today",     value: stats.total,                 sub: "submitted since midnight",                 icon: <IcoDoc />,   delay: "0ms",   variant: "indigo",  tooltip: "Claims today" },
    { label: "AI Resolved",      value: `${stats.autoApprovalRate}%`,sub: `${stats.approved} approved · ${stats.rejected} rejected`, icon: <IcoBot />, delay: "60ms",  variant: "emerald", tooltip: "Auto-resolved by AI" },
    { label: "Pending Review",   value: stats.pending,               sub: "awaiting human decision",                  icon: <IcoEye />,   delay: "120ms", variant: "orange",  tooltip: "Claims needing review" },
    { label: "Avg. Processing",  value: stats.avgProcessingTime > 0 ? `${stats.avgProcessingTime}m` : "—", sub: "intake → resolution", icon: <IcoClock />, delay: "180ms", variant: "rose", tooltip: "Average processing time" },
  ];

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" subtitle="Powered by Claude AI & UiPath Maestro" pending={stats.pending} />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">

        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </section>

        {/* Activity + Feed */}
        <div className="grid lg:grid-cols-5 gap-5 animate-fade-up-2">

          {/* Recent Activity */}
          <section className="lg:col-span-2 card-glow rounded-xl2 p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-semibold" style={{ color: "#E8EBF4" }}>Recent Activity</h2>
                <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background: "#6366F1" }} />
              </div>
              <Link href="/claims" className="text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: "#6366F1" }}>View all →</Link>
            </div>
            <ol className="space-y-4">
              {recentEvents.length === 0 && (
                <li className="text-xs py-6 text-center" style={{ color: "#3A4155" }}>No activity yet</li>
              )}
              {recentEvents.map((ev, i) => {
                const actor = ACTOR_META[ev.actor] ?? { symbol: "·", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", color: "#4A5568" };
                return (
                  <li key={ev.id} className="flex items-start gap-3 text-xs animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{ background: actor.bg, border: `1px solid ${actor.border}`, color: actor.color }}>
                      {actor.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug" style={{ color: "#E8EBF4" }}>
                        <span className="font-semibold">{ev.claimantName}</span>
                        <span className="mx-1" style={{ color: "#3A4155" }}>·</span>
                        <span style={{ color: "#8B95B0" }}>{ev.stage.replace(/_/g, " ")}</span>
                      </p>
                      {ev.notes && <p className="truncate mt-0.5 text-[11px]" style={{ color: "#4A5568" }}>{ev.notes}</p>}
                    </div>
                    <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5" style={{ color: "#3A4155" }} suppressHydrationWarning>
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
          <section className="lg:col-span-2 card-glow rounded-xl2 p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: "#E8EBF4" }}>Claims by Status</h2>
              <span className="text-[11px] font-mono-id" style={{ color: "#3A4155" }}>{totalClaims} total</span>
            </div>
            <ul className="space-y-3.5">
              {(["APPROVED", "PENDING_REVIEW", "ESCALATED", "VALIDATING", "EXTRACTING", "SUBMITTED", "REJECTED"] as ClaimStatus[]).map((st, idx) => {
                const count  = statusCounts[st] ?? 0;
                const pct    = Math.round((count / Math.max(1, totalClaims)) * 100);
                const barPct = Math.round((count / maxCount) * 100);
                const color  = STATUS_BAR[st] ?? "#4A5568";
                return (
                  <li key={st} className="animate-stagger" style={{ "--i": idx } as React.CSSProperties}>
                    <div className="flex items-center justify-between text-[11px] mb-2">
                      <span className="font-medium" style={{ color: "#8B95B0" }}>{st.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-id" style={{ color: "#3A4155" }}>{pct}%</span>
                        <span className="font-mono-id font-bold tabular-nums w-6 text-right" style={{ color: count > 0 ? color : "#3A4155" }}>{count}</span>
                      </div>
                    </div>
                    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full animate-bar"
                        style={{ width: `${barPct}%`, background: color, boxShadow: count > 0 ? `0 0 8px ${color}40` : "none" }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card-glow rounded-xl2 p-5 flex flex-col">
            <h2 className="text-sm font-semibold mb-5" style={{ color: "#E8EBF4" }}>All-Time</h2>
            <div className="space-y-3 flex-1">
              <div className="p-4 rounded-xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)" }}>
                <p className="text-[10px] font-semibold mb-1.5 tracking-wide" style={{ color: "rgba(52,211,153,0.7)" }}>AI Resolved</p>
                <p className="text-4xl font-bold font-mono-id leading-none tabular-nums" style={{ color: "#34D399" }}>{autoResolvedAll}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(16,185,129,0.5)" }}>claims processed by AI</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}>
                <p className="text-[10px] font-semibold mb-1.5 tracking-wide" style={{ color: "rgba(129,140,248,0.7)" }}>Total Claims</p>
                <p className="text-4xl font-bold font-mono-id leading-none tabular-nums" style={{ color: "#818CF8" }}>{totalClaims}</p>
                <p className="text-[11px] mt-1.5" style={{ color: "rgba(99,102,241,0.5)" }}>ever submitted</p>
              </div>
            </div>
            <Link href="/claims" className="mt-5 text-[11px] font-medium transition-colors hover:opacity-80" style={{ color: "#6366F1" }}>Browse all claims →</Link>
          </section>
        </div>

        {/* CTAs */}
        <section className="flex flex-wrap gap-3 pb-4 animate-fade-up-4">
          <Link href="/claims/new"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Submit New Claim
          </Link>
          <Link href="/review"
            className="flex items-center gap-2.5 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200"
            style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#FB923C" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Review Queue
            {stats.pending > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "#F97316", boxShadow: "0 2px 8px rgba(249,115,22,0.4)" }}>
                {stats.pending}
              </span>
            )}
          </Link>
          <Link href="/claims"
            className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 btn-ghost">
            All Claims
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </section>
      </main>
    </div>
  );
}
