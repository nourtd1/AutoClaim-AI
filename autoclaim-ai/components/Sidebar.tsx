"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    href: "/", label: "Dashboard", exact: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: "/claims", label: "Claims",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: "/review", label: "Review Queue",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    href: "/claims/new", label: "New Claim", exact: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/review/stats")
      .then(r => r.json())
      .then(j => { if (typeof j?.data?.pending === "number") setPendingCount(j.data.pending); })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-52 flex-col z-30 sidebar-bg">

        {/* Logo */}
        <div className="px-4 pt-5 pb-4">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Icon mark: signal waveform in a dark square */}
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--green-border)",
                boxShadow: "0 0 12px var(--green-glow)",
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h3l2-6 2 12 2-8 1.5 4.5H20" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
                AutoClaim
              </p>
              <p className="text-[10px] font-semibold tracking-wider" style={{ color: "var(--green)" }}>
                AI / MAESTRO
              </p>
            </div>
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px" style={{ background: "var(--border)" }} />

        {/* Nav */}
        <div className="flex-1 px-2.5 py-3 space-y-px">
          {NAV.map(({ href, label, icon, exact }) => {
            const active  = exact ? pathname === href : pathname.startsWith(href);
            const isNew   = href === "/claims/new";
            return (
              <Link key={href} href={href}
                className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg group"
                style={{
                  background: active ? "var(--green-dim)" : "transparent",
                  color: active
                    ? "var(--green-bright)"
                    : isNew
                    ? "var(--green)"
                    : "var(--text-2)",
                  fontWeight: active ? 600 : 400,
                  transition: "background 160ms cubic-bezier(0.25,1,0.5,1), color 130ms cubic-bezier(0.25,1,0.5,1)",
                }}>
                {/* Active indicator line */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-r-full"
                    style={{
                      background: "var(--green)",
                      boxShadow: "2px 0 8px var(--green-glow)",
                    }} />
                )}
                <span className="shrink-0" style={{
                  color: active
                    ? "var(--green)"
                    : isNew
                    ? "oklch(0.70 0.17 155 / 0.65)"
                    : "var(--text-3)",
                  transition: "color 130ms cubic-bezier(0.25,1,0.5,1)",
                }}>
                  {icon}
                </span>
                <span className="text-[13px] truncate">{label}</span>
                {/* Pending badge */}
                {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                  <span className="ml-auto shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-black flex items-center justify-center px-1"
                    style={{
                      background: "oklch(0.80 0.13 78)",
                      boxShadow: "0 1px 6px oklch(0.80 0.13 78 / 0.50)",
                    }}>
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
                {/* Hover arrow */}
                {!active && !isNew && (
                  <svg className="ml-auto shrink-0 opacity-0 group-hover:opacity-40 transition-opacity duration-150" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom — AI status */}
        <div className="px-3 pb-5">
          <div className="h-px mb-3" style={{ background: "var(--border)" }} />
          {/* System status chip */}
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2.5"
            style={{
              background: "var(--green-dim)",
              border: "1px solid var(--green-border)",
            }}>
            <div className="h-1.5 w-1.5 rounded-full shrink-0 animate-live"
              style={{ background: "var(--green)" }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: "var(--green-bright)" }}>AI System Online</p>
              <p className="text-[10px]" style={{ color: "oklch(0.70 0.17 155 / 0.55)" }}>Claude + Maestro active</p>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2 sidebar-bg">
        {NAV.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className="relative flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg transition-all duration-150 min-h-[44px] justify-center"
              style={active
                ? { color: "var(--green-bright)", background: "var(--green-dim)" }
                : { color: "var(--text-3)" }
              }>
              {icon}
              <span className="text-[10px] uppercase tracking-wide font-semibold">{label.split(" ")[0]}</span>
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full text-[9px] font-bold text-black flex items-center justify-center px-1"
                  style={{ background: "oklch(0.80 0.13 78)" }}>
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
