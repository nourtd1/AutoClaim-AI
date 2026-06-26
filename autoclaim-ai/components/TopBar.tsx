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
    subtitle: "Real-time pipeline overview",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  "/claims": {
    title: "All Claims",
    subtitle: "Search and manage claims",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  "/claims/new": {
    title: "New Claim",
    subtitle: "Submit a new insurance claim",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  },
  "/review": {
    title: "Review Queue",
    subtitle: "Claims awaiting human decision",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
};

export default function TopBar({ title, subtitle, badge, actions, pending }: TopBarProps) {
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? (
    pathname.startsWith("/claims/") && !pathname.startsWith("/claims/new")
      ? {
          title: "Claim Detail",
          subtitle: "View and manage this claim",
          icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
        }
      : null
  );

  const displayTitle = title || meta?.title || "AutoClaim AI";
  const displaySub   = subtitle || meta?.subtitle;
  const displayIcon  = meta?.icon;

  return (
    <header className="sticky top-0 z-40 topbar-bg">
      {/* Signal accent line at very top */}
      <div className="h-px w-full"
        style={{ background: "linear-gradient(90deg, transparent 0%, oklch(0.72 0.18 142 / 0.45) 40%, oklch(0.72 0.18 142 / 0.45) 60%, transparent 100%)" }} />

      <div className="px-6 py-3 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {displayIcon && (
            <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: "oklch(0.72 0.18 142 / 0.09)",
                border: "1px solid oklch(0.72 0.18 142 / 0.22)",
                color: "oklch(0.72 0.18 142)",
              }}>
              {displayIcon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight truncate" style={{ color: "oklch(0.93 0.005 140)" }}>
                {displayTitle}
              </h1>
              {badge && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: "oklch(0.80 0.13 78)",
                    color: "oklch(0.09 0.000 0)",
                    boxShadow: "0 1px 6px oklch(0.80 0.13 78 / 0.50)",
                  }}>
                  {badge}
                </span>
              )}
            </div>
            {displaySub && (
              <p className="text-[11px] truncate mt-px" style={{ color: "oklch(0.42 0.007 140)" }}>{displaySub}</p>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "oklch(0.72 0.18 142 / 0.08)",
              border: "1px solid oklch(0.72 0.18 142 / 0.20)",
            }}>
            <div className="h-1.5 w-1.5 rounded-full animate-live" style={{ background: "oklch(0.72 0.18 142)" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "oklch(0.72 0.18 142 / 0.85)" }}>Live</span>
          </div>

          {/* Pending review alert */}
          {pathname !== "/review" && pending !== undefined && pending > 0 && (
            <Link href="/review"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all duration-150"
              style={{
                background: "oklch(0.80 0.13 78 / 0.10)",
                border: "1px solid oklch(0.80 0.13 78 / 0.28)",
                color: "oklch(0.88 0.11 78)",
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  background: "oklch(0.80 0.13 78)",
                  color: "oklch(0.09 0.000 0)",
                  boxShadow: "0 1px 5px oklch(0.80 0.13 78 / 0.50)",
                }}>
                {pending}
              </span>
            </Link>
          )}

          {actions}

          {pathname !== "/claims/new" && (
            <Link href="/claims/new"
              className="flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12px] font-bold btn-primary">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Claim
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
