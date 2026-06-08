"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import type { Claim, ClaimStatus, ClaimPriority } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";

const PAGE_SIZE = 10;

const STATUSES: ClaimStatus[] = ["SUBMITTED","EXTRACTING","VALIDATING","PENDING_REVIEW","APPROVED","REJECTED","ESCALATED"];
const PRIORITIES: ClaimPriority[] = ["LOW","MEDIUM","HIGH","CRITICAL"];
const SOURCES = ["EMAIL","FORM","PDF"] as const;

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

interface Props {
  initialClaims: Claim[];
  initialStatus?: ClaimStatus | "";
}

export default function ClaimsClient({ initialClaims, initialStatus = "" }: Props) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "">(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState<ClaimPriority | "">("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (sourceFilter) params.set("source", sourceFilter);
      const res = await fetch(`/api/claims?${params.toString()}`);
      const json = await res.json();
      if (json.data) setClaims(json.data as Claim[]);
    });
  }, [statusFilter, priorityFilter, sourceFilter]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return claims.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (priorityFilter && c.priority !== priorityFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (q && !c.id.toLowerCase().includes(q) && !c.claimantName.toLowerCase().includes(q) && !c.policyNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [claims, search, statusFilter, priorityFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClaims = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const copyId = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const selectClass = "rounded-lg border border-white/10 bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer";

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search by ID, name or policy…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[160px] rounded-lg border border-white/10 bg-slate-900 text-slate-200 text-xs px-3 py-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ClaimStatus | ""); setPage(1); }} className={selectClass}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>

        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value as ClaimPriority | ""); setPage(1); }} className={selectClass}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 hover:border-emerald-700 transition-colors px-3 py-1.5 text-xs text-slate-400 disabled:opacity-50"
        >
          <span className={isPending ? "animate-spin" : ""}>↻</span> Refresh
        </button>
      </div>

      {/* ── Count line ── */}
      <p className="text-xs text-slate-500">
        {filtered.length} claim{filtered.length !== 1 ? "s" : ""} found
        {search || statusFilter || priorityFilter || sourceFilter ? " (filtered)" : ""}
      </p>

      {/* ── Table (desktop) ── */}
      <div className="hidden md:block glass rounded-xl2 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-slate-500 uppercase tracking-wider text-[10px]">
              <th className="px-4 py-3 text-left font-medium">ID</th>
              <th className="px-4 py-3 text-left font-medium">Claimant</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Stage</th>
              <th className="px-4 py-3 text-right font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {pageClaims.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-600">No claims match your filters</td>
              </tr>
            )}
            {pageClaims.map((c) => (
              <tr
                key={c.id}
                onClick={() => window.location.href = `/claims/${c.id}`}
                className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-id text-slate-400">{c.id.slice(0, 8)}…</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); copyId(c.id); }}
                      title="Copy full ID"
                      className="text-slate-600 hover:text-slate-300 transition-colors"
                    >
                      {copied === c.id ? "✓" : "⎘"}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-200 font-medium">{c.claimantName}</p>
                  <p className="text-slate-600 font-mono-id text-[10px]">{c.policyNumber}</p>
                </td>
                <td className="px-4 py-3 text-slate-400">{c.claimType.replace(/_/g," ")}</td>
                <td className="px-4 py-3 text-right font-mono-id font-semibold text-emerald-400 tabular-nums">{fmtAmount(c.claimAmount, c.currency)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} size="sm" /></td>
                <td className="px-4 py-3"><PriorityBadge priority={c.priority} size="sm" /></td>
                <td className="px-4 py-3 text-slate-500">{c.stage.replace(/_/g," ")}</td>
                <td className="px-4 py-3 text-right text-slate-600 font-mono-id tabular-nums">{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-2">
        {pageClaims.length === 0 && (
          <p className="text-center text-xs text-slate-600 py-8">No claims match your filters</p>
        )}
        {pageClaims.map((c) => (
          <Link key={c.id} href={`/claims/${c.id}`} className="block glass glass-hover rounded-xl p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-200">{c.claimantName}</p>
                <p className="font-mono-id text-[10px] text-slate-500">{c.policyNumber}</p>
              </div>
              <StatusBadge status={c.status} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono-id font-bold text-emerald-400">{fmtAmount(c.claimAmount, c.currency)}</span>
              <PriorityBadge priority={c.priority} size="sm" />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 disabled:opacity-30 hover:border-white/20 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-slate-500 font-mono-id">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 disabled:opacity-30 hover:border-white/20 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
