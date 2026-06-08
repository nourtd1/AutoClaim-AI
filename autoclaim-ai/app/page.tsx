import Link from "next/link";
import type { Metadata } from "next";
import { initDb, getAllClaims, getRecentStageEvents, getDb } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import LiveFeed from "./dashboard/LiveFeed";

initDb();

export const metadata: Metadata = { title: "Dashboard" };

// ── Stats (direct DB, no internal HTTP) ──────────────────────────────────────

interface DashboardStats {
  total: number; approved: number; rejected: number;
  escalated: number; pending: number;
  avgProcessingTime: number; autoApprovalRate: number;
}

function fetchStats(): DashboardStats {
  const db = getDb();
  const s = new Date(); s.setHours(0, 0, 0, 0);
  const start = s.toISOString();
  const end   = new Date().toISOString();

  type CR = { cnt: number };
  type AR = { avg_minutes: number | null };

  const total    = (db.prepare(`SELECT COUNT(*) as cnt FROM claims WHERE createdAt>=? AND createdAt<=? AND deletedAt IS NULL`).get(start,end) as CR).cnt;
  const approved = (db.prepare(`SELECT COUNT(*) as cnt FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`).get(start,end) as CR).cnt;
  const rejected = (db.prepare(`SELECT COUNT(*) as cnt FROM claims WHERE status='REJECTED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`).get(start,end) as CR).cnt;
  const escalated= (db.prepare(`SELECT COUNT(*) as cnt FROM claims WHERE status='ESCALATED' AND updatedAt>=? AND updatedAt<=? AND deletedAt IS NULL`).get(start,end) as CR).cnt;
  const pending  = (db.prepare(`SELECT COUNT(*) as cnt FROM claims WHERE status IN ('PENDING_REVIEW','ESCALATED') AND deletedAt IS NULL`).get() as CR).cnt;
  const avgRow   = db.prepare(`SELECT AVG((julianday(resolvedAt)-julianday(createdAt))*1440) as avg_minutes FROM claims WHERE resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`).get(start,end) as AR;
  const avgProcessingTime = Math.round(avgRow.avg_minutes ?? 0);

  const approvedIds = (db.prepare(`SELECT id FROM claims WHERE status='APPROVED' AND resolvedAt>=? AND resolvedAt<=? AND deletedAt IS NULL`).all(start,end) as {id:string}[]).map(r=>r.id);
  let autoApproved = 0;
  for (const id of approvedIds) {
    if (!db.prepare(`SELECT 1 FROM stage_events WHERE claimId=? AND actor='HUMAN' LIMIT 1`).get(id)) autoApproved++;
  }
  const autoApprovalRate = approved > 0 ? Math.round((autoApproved / approved) * 100) : 0;
  return { total, approved, rejected, escalated, pending, avgProcessingTime, autoApprovalRate };
}

// ── KPI card with tooltip ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, tooltip }: {
  label: string; value: string | number; sub?: string;
  accent?: "emerald"|"violet"|"orange"|"rose"; tooltip: string;
}) {
  const accentClass = { emerald:"text-emerald-400", violet:"text-violet-400", orange:"text-orange-400", rose:"text-rose-400" }[accent ?? "emerald"];
  return (
    <div className="glass rounded-xl p-5 space-y-1 group relative">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium leading-tight">{label}</p>
        {/* Tooltip trigger */}
        <span className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors cursor-help text-[11px] leading-tight mt-px">?
          <span className="pointer-events-none absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 w-48 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[11px] text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity text-left font-normal normal-case tracking-normal">
            {tooltip}
          </span>
        </span>
      </div>
      <p className={`text-3xl font-bold font-mono-id ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const STATUS_BAR_COLOR: Record<string, string> = {
  SUBMITTED:"bg-slate-500", EXTRACTING:"bg-blue-500", VALIDATING:"bg-violet-500",
  PENDING_REVIEW:"bg-orange-500", APPROVED:"bg-emerald-500", REJECTED:"bg-red-600", ESCALATED:"bg-rose-500",
};

const ACTOR_ICON: Record<string, string> = { AGENT:"🧠", ROBOT:"⚙️", HUMAN:"👤" };

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, allClaims, recentEvents] = [
    fetchStats(),
    getAllClaims(),
    getRecentStageEvents(5),
  ];

  const statusCounts: Record<string, number> = {};
  for (const c of allClaims) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  const maxCount = Math.max(1, ...Object.values(statusCounts));
  const totalClaims = allClaims.length;
  const autoResolvedAll = allClaims.filter(c => c.status === "APPROVED").length;

  return (
    <div className="min-h-screen bg-[#0F1117]">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">AC</div>
            <span className="font-semibold text-slate-100 text-sm tracking-tight">AutoClaim <span className="text-emerald-400">AI</span></span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-violet-700 bg-violet-950 px-2 py-0.5 text-[10px] font-medium text-violet-300 ml-2">
              UiPath AgentHack 2026
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/claims/new" className="rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-colors px-3 py-1.5 text-xs font-semibold text-white">
              + New Claim
            </Link>
            <Link href="/review" className="rounded-lg border border-white/10 hover:border-orange-500/50 hover:bg-orange-950/30 transition-colors px-3 py-1.5 text-xs font-medium text-slate-300">
              Review Queue {stats.pending > 0 && <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{stats.pending}</span>}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* KPI row */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">Today&apos;s Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Claims Today" value={stats.total}
              sub="submitted since midnight" accent="emerald"
              tooltip="Claims created today (since midnight local time). Includes all statuses." />
            <KpiCard label="Auto-Resolved" value={`${stats.autoApprovalRate}%`}
              sub={`${stats.approved} approved, ${stats.rejected} rejected`} accent="violet"
              tooltip="Share of today's resolved claims approved automatically by AI — with no human decision event in their timeline." />
            <KpiCard label="Pending Review" value={stats.pending}
              sub="awaiting human decision" accent="orange"
              tooltip="Open claims currently in PENDING_REVIEW or ESCALATED status across all days. Human action required." />
            <KpiCard label="Avg. Processing" value={stats.avgProcessingTime > 0 ? `${stats.avgProcessingTime}m` : "—"}
              sub="intake → resolution" accent="rose"
              tooltip="Average minutes from claim creation to final resolution (APPROVED or REJECTED) for claims resolved today." />
          </div>
        </section>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Recent Activity (server) */}
          <section className="lg:col-span-2 glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
              <Link href="/claims" className="text-xs text-emerald-400 hover:underline">View all →</Link>
            </div>
            <ol className="space-y-3">
              {recentEvents.length === 0 && (
                <li className="text-xs text-slate-500 py-4 text-center">No activity yet</li>
              )}
              {recentEvents.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-xs">
                  <span className="mt-0.5 text-sm">{ACTOR_ICON[ev.actor] ?? "•"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 truncate">
                      <span className="font-semibold">{ev.claimantName}</span>
                      {" — "}<span className="text-slate-400">{ev.stage.replace(/_/g," ")}</span>
                    </p>
                    {ev.notes && <p className="text-slate-500 truncate mt-0.5">{ev.notes}</p>}
                  </div>
                  <time className="shrink-0 text-slate-600 font-mono-id tabular-nums">{relativeTime(ev.timestamp)}</time>
                </li>
              ))}
            </ol>
          </section>

          {/* Live Feed (client — auto-refreshes every 5s) */}
          <div className="lg:col-span-3">
            <LiveFeed />
          </div>
        </div>

        {/* Claims by Status + all-time row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200">Claims by Status</h2>
              <span className="text-xs text-slate-500">{totalClaims} total</span>
            </div>
            <ul className="space-y-2.5">
              {(["APPROVED","PENDING_REVIEW","ESCALATED","VALIDATING","EXTRACTING","SUBMITTED","REJECTED"] as ClaimStatus[]).map((st) => {
                const count  = statusCounts[st] ?? 0;
                const pct    = Math.round((count / Math.max(1,totalClaims)) * 100);
                const barPct = Math.round((count / maxCount) * 100);
                return (
                  <li key={st}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">{st.replace(/_/g," ")}</span>
                      <span className="font-mono-id text-slate-300 tabular-nums">{count} <span className="text-slate-600">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${STATUS_BAR_COLOR[st] ?? "bg-slate-500"}`} style={{ width:`${barPct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="glass rounded-xl p-5 flex flex-col justify-between">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">All-Time</h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Auto-Resolved</p>
                <p className="text-3xl font-bold font-mono-id text-emerald-400">{autoResolvedAll}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Total Claims</p>
                <p className="text-3xl font-bold font-mono-id text-slate-300">{totalClaims}</p>
              </div>
            </div>
            <Link href="/claims" className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Browse all →
            </Link>
          </section>
        </div>

        {/* CTAs */}
        <section className="flex flex-wrap gap-3">
          <Link href="/claims/new" className="flex items-center gap-2 rounded-xl border border-emerald-700/50 bg-emerald-950/40 hover:bg-emerald-950/70 transition-colors px-5 py-3 text-sm font-semibold text-emerald-300">
            <span>⚡</span> Submit New Claim
          </Link>
          <Link href="/review" className="flex items-center gap-2 rounded-xl border border-orange-700/50 bg-orange-950/40 hover:bg-orange-950/70 transition-colors px-5 py-3 text-sm font-semibold text-orange-300">
            <span>👁</span> Review Queue
            {stats.pending > 0 && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{stats.pending}</span>}
          </Link>
          <Link href="/claims" className="flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors px-5 py-3 text-sm font-medium text-slate-400">
            All Claims →
          </Link>
        </section>
      </main>
    </div>
  );
}
