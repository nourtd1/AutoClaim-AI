"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import type { Claim, ClaimStatus, ClaimPriority } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";

const PAGE_SIZE = 10;

const STATUSES: ClaimStatus[] = ["SUBMITTED", "EXTRACTING", "VALIDATING", "PENDING_REVIEW", "APPROVED", "REJECTED", "ESCALATED"];
const PRIORITIES: ClaimPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SOURCES = ["EMAIL", "FORM", "PDF"] as const;

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const AMOUNT_COLOR: Record<string, string> = {
  APPROVED:  "oklch(0.70 0.17 155)",
  REJECTED:  "oklch(0.68 0.22 22)",
  ESCALATED: "oklch(0.70 0.19 12)",
  DEFAULT:   "oklch(0.68 0.18 232)",
};

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

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(74,85,104,0.9)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            placeholder="Search by ID, name or policy…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-dark w-full text-xs pl-7 pr-3 py-1.5"
          />
        </div>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as ClaimStatus | ""); setPage(1); }}
          className="select-dark text-xs px-2.5 py-1.5 rounded-lg">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>

        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value as ClaimPriority | ""); setPage(1); }}
          className="select-dark text-xs px-2.5 py-1.5 rounded-lg">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="select-dark text-xs px-2.5 py-1.5 rounded-lg">
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button onClick={refresh} disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all duration-200 disabled:opacity-40 btn-ghost">
          <svg className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Count line */}
      <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
        <span className="font-semibold" style={{ color: "var(--text)" }}>{filtered.length}</span>{" "}
        claim{filtered.length !== 1 ? "s" : ""}
        {(search || statusFilter || priorityFilter || sourceFilter) && (
          <span style={{ color: "var(--text-3)" }}> · filtered</span>
        )}
      </p>

      {/* ── Table (desktop) ── */}
      <div className="hidden md:block card-glow rounded-xl2 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-mid)", background: "oklch(1.00 0.000 0 / 0.025)" }}>
              {["ID", "Claimant", "Type", "Amount", "Status", "Priority", "Stage", "Created"].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider ${i >= 3 && i <= 3 ? "text-right" : "text-left"}`}
                  style={{ color: "var(--text-4)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageClaims.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2" style={{ color: "var(--text-4)" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <span>No claims match your filters</span>
                  </div>
                </td>
              </tr>
            )}
            {pageClaims.map((c, i) => {
              const amtColor = AMOUNT_COLOR[c.status] ?? AMOUNT_COLOR.DEFAULT;
              return (
                <tr key={c.id}
                  onClick={() => window.location.href = `/claims/${c.id}`}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.location.href = `/claims/${c.id}`; } }}
                  tabIndex={0}
                  role="link"
                  aria-label={`View claim by ${c.claimantName}`}
                  className="cursor-pointer tr-hover animate-stagger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  style={{ borderBottom: "1px solid var(--border)", "--i": i, outlineColor: "var(--azure)" } as React.CSSProperties}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-id tabular-nums" style={{ color: "var(--text-3)" }}>{c.id.slice(0, 8)}…</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); copyId(c.id); }}
                        aria-label={copied === c.id ? "Copied" : "Copy claim ID"}
                        className="transition-colors"
                        style={{ color: copied === c.id ? "var(--azure)" : "oklch(1.00 0.000 0 / 0.20)" }}>
                        {copied === c.id
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{c.claimantName}</p>
                    <p className="font-mono-id text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{c.policyNumber}</p>
                  </td>
                  <td className="px-4 py-4" style={{ color: "var(--text-2)" }}>{c.claimType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-4 text-right font-mono-id font-bold tabular-nums" style={{ color: amtColor }}>{fmtAmount(c.claimAmount, c.currency)}</td>
                  <td className="px-4 py-4"><StatusBadge status={c.status} size="sm" /></td>
                  <td className="px-4 py-4"><PriorityBadge priority={c.priority} size="sm" /></td>
                  <td className="px-4 py-4" style={{ color: "var(--text-2)" }}>{c.stage.replace(/_/g, " ")}</td>
                  <td className="px-4 py-4 text-right font-mono-id tabular-nums" style={{ color: "var(--text-3)" }}>{fmtDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Cards (mobile) ── */}
      <div className="md:hidden space-y-2">
        {pageClaims.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: "var(--text-4)" }}>No claims match your filters</p>
        )}
        {pageClaims.map((c, i) => {
          const amtColor = AMOUNT_COLOR[c.status] ?? AMOUNT_COLOR.DEFAULT;
          return (
            <Link key={c.id} href={`/claims/${c.id}`}
              className="block claim-card rounded-xl p-3.5 space-y-2.5 animate-stagger"
              style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{c.claimantName}</p>
                  <p className="font-mono-id text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{c.policyNumber}</p>
                </div>
                <StatusBadge status={c.status} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono-id font-bold tabular-nums" style={{ color: amtColor }}>{fmtAmount(c.claimAmount, c.currency)}</span>
                <PriorityBadge priority={c.priority} size="sm" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-30 transition-all duration-200 btn-ghost">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Prev
          </button>
          <span className="text-xs font-mono-id" style={{ color: "var(--text-3)" }}>
            <span style={{ color: "var(--text)" }}>{page}</span> / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs disabled:opacity-30 transition-all duration-200 btn-ghost">
            Next
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
