"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TopBarProps {
  title: string;
  subtitle?: string;
  badge?: string | undefined;
  actions?: React.ReactNode;
  pending?: number | undefined;
}

const PAGE_META: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Real-time claims overview",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  "/claims": {
    title: "All Claims",
    subtitle: "Search, filter and manage claims",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  "/claims/new": {
    title: "New Claim",
    subtitle: "Submit a new insurance claim",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  },
  "/review": {
    title: "Review Queue",
    subtitle: "Claims awaiting human decision",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
};

export default function TopBar({ title, subtitle, badge, actions, pending }: TopBarProps) {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? (pathname.startsWith("/claims/") && !pathname.startsWith("/claims/new") ? {
    title: "Claim Detail", subtitle: "View and manage this claim",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  } : null);

  const displayTitle = title || meta?.title || "AutoClaim AI";
  const displaySub   = subtitle || meta?.subtitle;
  const displayIcon  = meta?.icon;

  return (
    <header className="sticky top-0 z-40 topbar-bg">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">

        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {displayIcon && (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.2)",
                color: "#818CF8",
              }}>
              {displayIcon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight truncate" style={{ color: "#E8EBF4" }}>
                {displayTitle}
              </h1>
              {badge && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: "#F97316", boxShadow: "0 2px 8px rgba(249,115,22,0.4)" }}>
                  {badge}
                </span>
              )}
            </div>
            {displaySub && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: "rgba(139,149,176,0.7)" }}>{displaySub}</p>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}>
            <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background: "#6366F1" }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(129,140,248,0.9)" }}>Live</span>
          </div>

          {pathname !== "/review" && pending !== undefined && pending > 0 && (
            <Link href="/review"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              style={{
                background: "rgba(249,115,22,0.1)",
                border: "1px solid rgba(249,115,22,0.25)",
                color: "#FB923C",
                transition: "background 150ms cubic-bezier(0.25,1,0.5,1), box-shadow 150ms cubic-bezier(0.25,1,0.5,1)",
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: "#F97316", boxShadow: "0 2px 6px rgba(249,115,22,0.4)" }}>{pending}</span>
            </Link>
          )}

          {actions}

          {pathname !== "/claims/new" && (
            <Link href="/claims/new"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all duration-200 btn-primary">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Claim
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
