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

  const selectClass = "rounded-lg text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer transition-all duration-200";
  const selectStyle = { background:"#FFFFFF", border:"1px solid #E2E8F0", color:"#1E293B" };
  const inputClass  = "flex-1 min-w-[180px] rounded-lg text-xs px-3 py-1.5 focus:outline-none transition-all duration-200";

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Search by ID, name or policy…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`${inputClass} pl-7`}
            style={{ background:"#FFFFFF", border:"1px solid #E2E8F0", color:"#1E293B" }}
          />
        </div>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ClaimStatus | ""); setPage(1); }} className={selectClass} style={selectStyle}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
        </select>

        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value as ClaimPriority | ""); setPage(1); }} className={selectClass} style={selectStyle}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} className={selectClass} style={selectStyle}>
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 disabled:opacity-40"
          style={{ background:"#FFFFFF", border:"1px solid #E2E8F0", color:"#64748B" }}
        >
          <svg className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Count line ── */}
      <p className="text-[11px]" style={{ color:"#94A3B8" }}>
        <span className="font-semibold" style={{ color:"#1E293B" }}>{filtered.length}</span> claim{filtered.length !== 1 ? "s" : ""}
        {search || statusFilter || priorityFilter || sourceFilter ? <span style={{ color:"#94A3B8" }}> · filtered</span> : ""}
      </p>

      {/* ── Table (desktop) ── */}
      <div className="hidden md:block rounded-xl2 overflow-hidden" style={{background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <table className="w-full text-xs">
          <thead>
            <tr className="uppercase tracking-widest text-[10px]" style={{borderBottom:"1px solid #F1F5F9",background:"#F8FAFC",color:"#94A3B8"}}>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Claimant</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Priority</th>
              <th className="px-4 py-3 text-left font-semibold">Stage</th>
              <th className="px-4 py-3 text-right font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {pageClaims.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2" style={{color:"#94A3B8"}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    No claims match your filters
                  </div>
                </td>
              </tr>
            )}
            {pageClaims.map((c) => (
              <tr
                key={c.id}
                onClick={() => window.location.href = `/claims/${c.id}`}
                className="cursor-pointer transition-all duration-150"
                style={{borderBottom:"1px solid #F8FAFC"}}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "#F8FAFC"}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-id tabular-nums" style={{color:"#94A3B8"}}>{c.id.slice(0,8)}…</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); copyId(c.id); }} title="Copy full ID" style={{color:copied===c.id?"#4F46E5":"#CBD5E1"}} className="transition-colors">
                      {copied===c.id
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold" style={{color:"#1E293B"}}>{c.claimantName}</p>
                  <p className="font-mono-id text-[10px] mt-0.5" style={{color:"#94A3B8"}}>{c.policyNumber}</p>
                </td>
                <td className="px-4 py-3" style={{color:"#64748B"}}>{c.claimType.replace(/_/g," ")}</td>
                <td className="px-4 py-3 text-right font-mono-id font-bold tabular-nums" style={{color:"#4338CA"}}>{fmtAmount(c.claimAmount,c.currency)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} size="sm" /></td>
                <td className="px-4 py-3"><PriorityBadge priority={c.priority} size="sm" /></td>
                <td className="px-4 py-3" style={{color:"#64748B"}}>{c.stage.replace(/_/g," ")}</td>
                <td className="px-4 py-3 text-right font-mono-id tabular-nums" style={{color:"#94A3B8"}}>{fmtDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-2">
        {pageClaims.length === 0 && (
          <p className="text-center text-xs py-8" style={{color:"#94A3B8"}}>No claims match your filters</p>
        )}
        {pageClaims.map((c) => (
          <Link key={c.id} href={`/claims/${c.id}`}
            className="block rounded-xl p-3.5 space-y-2.5 transition-all duration-200"
            style={{background:"#FFFFFF",border:"1px solid #E2E8F0",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#E9D5FF" }}>{c.claimantName}</p>
                <p className="font-mono-id text-[10px] mt-0.5" style={{ color: "rgba(168,85,247,0.4)" }}>{c.policyNumber}</p>
              </div>
              <StatusBadge status={c.status} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono-id font-bold" style={{ color:"#4338CA" }}>{fmtAmount(c.claimAmount, c.currency)}</span>
              <PriorityBadge priority={c.priority} size="sm" />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-30 transition-all duration-200"
            style={{background:"#FFFFFF",border:"1px solid #E2E8F0",color:"#475569"}}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Prev
          </button>
          <span className="text-xs font-mono-id" style={{color:"#64748B"}}>
            <span style={{color:"#1E293B"}}>{page}</span> / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-30 transition-all duration-200"
            style={{background:"#FFFFFF",border:"1px solid #E2E8F0",color:"#475569"}}
          >
            Next
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
