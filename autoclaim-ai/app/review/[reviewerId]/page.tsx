"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Claim, Reviewer } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import LiveCounter from "@/components/ui/LiveCounter";

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function computeStats(claims: Claim[]) {
  const { start, end } = todayRange();
  const todayClaims = claims.filter((c) => c.updatedAt >= start && c.updatedAt <= end);
  const reviewed  = todayClaims.filter((c) => c.status === "APPROVED" || c.status === "REJECTED").length;
  const approved  = todayClaims.filter((c) => c.status === "APPROVED").length;
  const approvalRate = reviewed > 0 ? Math.round((approved / reviewed) * 100) : 0;

  const resolved = claims.filter((c) => c.resolvedAt);
  const avgMinutes = resolved.length > 0
    ? Math.round(
        resolved.reduce((s, c) => {
          const ms = new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime();
          return s + ms / 60_000;
        }, 0) / resolved.length
      )
    : 0;

  return { reviewedToday: reviewed, approvalRate, avgDecisionMinutes: avgMinutes };
}

export default function ReviewerPage() {
  const params = useParams<{ reviewerId: string }>();
  const router = useRouter();

  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [claims, setClaims]     = useState<Claim[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    setLoading(true);
    fetch(`/api/reviewers/${params.reviewerId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) { setReviewer(j.data.reviewer); setClaims(j.data.claims); }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [params.reviewerId]);

  const toggleAvailability = () => {
    if (!reviewer) return;
    startTransition(async () => {
      const res = await fetch(`/api/reviewers/${reviewer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !reviewer.isAvailable }),
      });
      const json = await res.json();
      if (json.data) setReviewer(json.data as Reviewer);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-status-pulse">Loading…</p>
      </div>
    );
  }

  if (!reviewer) {
    return (
      <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center gap-3">
        <p className="text-slate-400">Reviewer not found</p>
        <button onClick={() => router.back()} className="text-xs text-violet-400 hover:underline">← Go back</button>
      </div>
    );
  }

  const stats = computeStats(claims);
  const active  = claims.filter((c) => c.status === "PENDING_REVIEW" || c.status === "ESCALATED");
  const history = claims.filter((c) => c.status === "APPROVED" || c.status === "REJECTED");

  return (
    <div className="min-h-screen bg-[#0F1117]">
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5">
              <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-[10px]">AC</div>
            </Link>
            <span className="text-slate-700">/</span>
            <Link href="/review" className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Review Queue</Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-300">{reviewer.name}</span>
          </div>
          <button
            onClick={toggleAvailability}
            disabled={isPending}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              reviewer.isAvailable
                ? "border-emerald-700 bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                : "border-red-800 bg-red-950 text-red-300 hover:bg-red-900"
            }`}
          >
            {reviewer.isAvailable ? "✓ Available" : "✗ Unavailable"} — Toggle
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Reviewer profile */}
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-violet-900 border-2 border-violet-600 flex items-center justify-center text-2xl font-bold text-violet-200">
            {reviewer.name.slice(0, 1)}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">{reviewer.name}</h1>
            <p className="text-sm text-slate-500">{reviewer.role} · {reviewer.email}</p>
          </div>
        </div>

        {/* Personal stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-1">
            <LiveCounter value={stats.reviewedToday} label="Reviewed Today" color="text-emerald-400" />
          </div>
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-1">
            <LiveCounter value={stats.avgDecisionMinutes} label="Avg Decision (min)" color="text-violet-400" />
          </div>
          <div className="glass rounded-xl p-4 flex flex-col items-center gap-1">
            <LiveCounter value={stats.approvalRate} label="Approval Rate %" color="text-orange-400" />
          </div>
        </div>

        {/* Active claims */}
        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">My Claims — Active ({active.length})</h2>
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-left font-medium">Claimant</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Since</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {active.map((c) => (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-200 font-medium">{c.claimantName}</td>
                      <td className="px-4 py-3 text-slate-400">{c.claimType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-mono-id text-emerald-400 tabular-nums">{fmtAmount(c.claimAmount, c.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} size="sm" /></td>
                      <td className="px-4 py-3 text-right font-mono-id text-slate-600 tabular-nums">{fmtDate(c.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/claims/${c.id}#review`} className="text-violet-400 hover:underline font-medium">Review →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-400">History ({history.length})</h2>
            <div className="glass rounded-xl overflow-hidden opacity-75">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-3 text-left font-medium">Claimant</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Decision</th>
                    <th className="px-4 py-3 text-right font-medium">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-3 text-slate-400">{c.claimantName}</td>
                      <td className="px-4 py-3 text-right font-mono-id text-slate-400 tabular-nums">{fmtAmount(c.claimAmount, c.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} size="sm" /></td>
                      <td className="px-4 py-3 text-right font-mono-id text-slate-600 tabular-nums">{fmtDate(c.resolvedAt ?? c.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {claims.length === 0 && (
          <p className="text-center text-sm text-slate-600 py-12">No claims assigned yet</p>
        )}
      </main>
    </div>
  );
}
