import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getAllClaims, getRecentStageEvents, getDb } from "@/lib/db";
import type { ClaimStatus, DashboardStats } from "@/lib/types";
import LiveFeed from "./dashboard/LiveFeed";
import TopBar from "@/components/TopBar";
import KpiNumber from "@/components/ui/KpiNumber";

export const metadata: Metadata = { title: "Dashboard" };

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

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiConfig {
  label: string; value: string | number; sub?: string; tooltip: string;
  icon: React.ReactNode; delay: string;
  accent: string; accentDim: string; accentBorder: string;
}

function KpiCard({ label, value, sub, tooltip, icon, delay, accent, accentDim, accentBorder }: KpiConfig) {
  return (
    <div
      className="kpi-card rounded-xl p-5 space-y-3 relative overflow-hidden animate-fade-up"
      style={{ animationDelay: delay }}
      title={tooltip}>

      {/* Subtle top signal line */}
      <div className="absolute top-0 left-6 right-6 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.45 }} />

      {/* Icon + label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: accentDim, border: `1px solid ${accentBorder}` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        <p className="text-[11px] font-medium text-right leading-snug"
          style={{ color: "oklch(0.42 0.007 140)" }}>{label}</p>
      </div>

      {/* Value */}
      <div>
        <KpiNumber value={value} color={accent} />
        {sub && <p className="text-[11px] mt-1.5 truncate" style={{ color: "oklch(0.35 0.005 140)" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_BAR: Record<string, string> = {
  SUBMITTED:      "oklch(0.44 0.009 250)",
  EXTRACTING:     "oklch(0.68 0.18 232)",
  VALIDATING:     "oklch(0.70 0.17 155)",
  PENDING_REVIEW: "oklch(0.80 0.13 78)",
  APPROVED:       "oklch(0.70 0.17 155)",
  REJECTED:       "oklch(0.68 0.22 22)",
  ESCALATED:      "oklch(0.70 0.19 12)",
};

const ACTOR_META: Record<string, { symbol: string; bg: string; border: string; color: string }> = {
  AGENT: { symbol: "✦", bg: "oklch(0.70 0.17 155 / 0.11)", border: "oklch(0.70 0.17 155 / 0.25)", color: "oklch(0.80 0.15 155)" },
  ROBOT: { symbol: "◆", bg: "oklch(0.68 0.18 232 / 0.11)", border: "oklch(0.68 0.18 232 / 0.25)", color: "oklch(0.78 0.15 232)" },
  HUMAN: { symbol: "●", bg: "oklch(0.80 0.13 78 / 0.11)",  border: "oklch(0.80 0.13 78 / 0.25)",  color: "oklch(0.88 0.11 78)" },
};

function relativeTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const IcoDoc   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>;
const IcoBot   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="6" r="2"/></svg>;
const IcoEye   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoClock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>;

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
    {
      label: "Claims Today", value: stats.total, sub: "submitted since midnight",
      icon: <IcoDoc />, delay: "0ms", tooltip: "Claims today",
      accent: "oklch(0.70 0.17 155)", accentDim: "oklch(0.70 0.17 155 / 0.12)", accentBorder: "oklch(0.70 0.17 155 / 0.25)",
    },
    {
      label: "AI Resolved", value: `${stats.autoApprovalRate}%`, sub: `${stats.approved} approved · ${stats.rejected} rejected`,
      icon: <IcoBot />, delay: "55ms", tooltip: "Auto-resolved by AI",
      accent: "oklch(0.68 0.18 232)", accentDim: "oklch(0.68 0.18 232 / 0.12)", accentBorder: "oklch(0.68 0.18 232 / 0.25)",
    },
    {
      label: "Pending Review", value: stats.pending, sub: "awaiting human decision",
      icon: <IcoEye />, delay: "110ms", tooltip: "Claims needing review",
      accent: "oklch(0.80 0.13 78)", accentDim: "oklch(0.80 0.13 78 / 0.11)", accentBorder: "oklch(0.80 0.13 78 / 0.25)",
    },
    {
      label: "Avg. Processing", value: stats.avgProcessingTime > 0 ? `${stats.avgProcessingTime}m` : "—", sub: "intake → resolution",
      icon: <IcoClock />, delay: "165ms", tooltip: "Average processing time",
      accent: "oklch(0.68 0.22 22)", accentDim: "oklch(0.68 0.22 22 / 0.10)", accentBorder: "oklch(0.68 0.22 22 / 0.25)",
    },
  ];

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" subtitle="Powered by Claude AI & UiPath Maestro" pending={stats.pending} />

      <main className="mx-auto max-w-7xl px-6 py-7 space-y-5">

        {/* KPIs */}
        <section>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(kpi => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </section>

        {/* Activity feed + live events */}
        <div className="grid lg:grid-cols-5 gap-4 animate-fade-up-2">

          {/* Recent Activity */}
          <section className="lg:col-span-2 card-glow rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Recent Activity</h2>
                <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background: "var(--green)" }} />
              </div>
              <Link href="/claims"
                className="text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--azure)" }}>
                View all →
              </Link>
            </div>
            <ol className="space-y-4">
              {recentEvents.length === 0 && (
                <li className="text-xs py-6 text-center" style={{ color: "var(--text-4)" }}>No activity yet</li>
              )}
              {recentEvents.map((ev, i) => {
                const actor = ACTOR_META[ev.actor] ?? {
                  symbol: "·",
                  bg: "oklch(1.00 0.000 0 / 0.04)",
                  border: "oklch(1.00 0.000 0 / 0.08)",
                  color: "var(--text-3)",
                };
                return (
                  <li key={ev.id} className="flex items-start gap-3 text-xs animate-fade-up" style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                      style={{ background: actor.bg, border: `1px solid ${actor.border}`, color: actor.color }}>
                      {actor.symbol}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug" style={{ color: "var(--text)" }}>
                        <span className="font-semibold">{ev.claimantName}</span>
                        <span className="mx-1" style={{ color: "var(--text-4)" }}>·</span>
                        <span style={{ color: "var(--text-2)" }}>{ev.stage.replace(/_/g, " ")}</span>
                      </p>
                      {ev.notes && (
                        <p className="truncate mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                          {ev.notes}
                        </p>
                      )}
                    </div>
                    <time className="shrink-0 font-mono-id tabular-nums text-[10px] pt-0.5"
                      style={{ color: "var(--text-4)" }}
                      suppressHydrationWarning>
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

        {/* Status breakdown + all-time */}
        <div className="grid lg:grid-cols-3 gap-4 animate-fade-up-3">

          {/* Claims by Status */}
          <section className="lg:col-span-2 card-glow rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Claims by Status</h2>
              <span className="text-[11px] font-mono-id" style={{ color: "var(--text-4)" }}>
                {totalClaims} total
              </span>
            </div>
            <ul className="space-y-3.5">
              {(["APPROVED", "PENDING_REVIEW", "ESCALATED", "VALIDATING", "EXTRACTING", "SUBMITTED", "REJECTED"] as ClaimStatus[]).map((st, idx) => {
                const count  = statusCounts[st] ?? 0;
                const pct    = Math.round((count / Math.max(1, totalClaims)) * 100);
                const barPct = Math.round((count / maxCount) * 100);
                const color  = STATUS_BAR[st] ?? "oklch(0.38 0.005 140)";
                return (
                  <li key={st} className="animate-stagger" style={{ "--i": idx } as React.CSSProperties}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-medium" style={{ color: "var(--text-2)" }}>
                        {st.replace(/_/g, " ")}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-id" style={{ color: "var(--text-4)" }}>{pct}%</span>
                        <span className="font-mono-id font-bold tabular-nums w-6 text-right"
                          style={{ color: count > 0 ? color : "var(--text-4)" }}>
                          {count}
                        </span>
                      </div>
                    </div>
                    <div className="h-px w-full rounded-full overflow-hidden" style={{ background: "var(--border-mid)" }}>
                      <div className="h-full rounded-full animate-bar"
                        style={{
                          width: `${barPct}%`,
                          background: color,
                          boxShadow: count > 0 ? `0 0 6px ${color}` : "none",
                        }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* All-time stats */}
          <section className="card-glow rounded-xl p-5 flex flex-col">
            <h2 className="text-[13px] font-semibold mb-4" style={{ color: "var(--text)" }}>All-Time</h2>
            <div className="space-y-3 flex-1">
              {/* AI Resolved */}
              <div className="p-4 rounded-xl"
                style={{
                  background: "oklch(0.68 0.18 232 / 0.08)",
                  border: "1px solid oklch(0.68 0.18 232 / 0.22)",
                }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.68 0.18 232)" }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "oklch(0.68 0.18 232 / 0.75)" }}>
                    AI Resolved
                  </p>
                </div>
                <p className="text-3xl font-bold font-mono-id leading-none tabular-nums"
                  style={{ color: "oklch(0.78 0.15 232)" }}>
                  {autoResolvedAll}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: "oklch(0.68 0.18 232 / 0.55)" }}>
                  claims processed by AI
                </p>
              </div>
              {/* Total claims */}
              <div className="p-4 rounded-xl"
                style={{
                  background: "oklch(1.00 0.000 0 / 0.04)",
                  border: "1px solid var(--border-mid)",
                }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--text-3)" }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                    Total Claims
                  </p>
                </div>
                <p className="text-3xl font-bold font-mono-id leading-none tabular-nums"
                  style={{ color: "var(--text-2)" }}>
                  {totalClaims}
                </p>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--text-4)" }}>
                  ever submitted
                </p>
              </div>
            </div>
            <Link href="/claims"
              className="mt-4 text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--azure)" }}>
              Browse all claims →
            </Link>
          </section>
        </div>

        {/* CTAs */}
        <section className="flex flex-wrap gap-3 pb-2 animate-fade-up-4">
          <Link href="/claims/new"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-bold transition-all duration-200 btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Submit New Claim
          </Link>
          <Link href="/review"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-semibold transition-all duration-150"
            style={{
              background: "oklch(0.80 0.13 78 / 0.10)",
              border: "1px solid oklch(0.80 0.13 78 / 0.28)",
              color: "oklch(0.88 0.11 78)",
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            Review Queue
            {stats.pending > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: "oklch(0.80 0.13 78)",
                  color: "oklch(0.09 0.000 0)",
                  boxShadow: "0 1px 6px oklch(0.80 0.13 78 / 0.50)",
                }}>
                {stats.pending}
              </span>
            )}
          </Link>
          <Link href="/claims"
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-medium transition-all duration-150 btn-ghost">
            All Claims
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </section>

      </main>
    </div>
  );
}
