"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    href: "/", label: "Dashboard", exact: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    href: "/claims/new", label: "New Claim", exact: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-52 flex-col py-5 z-30 sidebar-bg">

        {/* Logo */}
        <div className="px-4 mb-7">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 group-hover:scale-105 group-hover:shadow-indigo"
              style={{
                background: "linear-gradient(135deg, #6366F1, #7C3AED)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset",
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h4l2-6 2 12 2-8 1 4h5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: "#E8EBF4" }}>
                AutoClaim <span style={{ color: "#818CF8" }}>AI</span>
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(139,149,176,0.7)" }}>UiPath AgentHack</p>
            </div>
          </Link>
        </div>

        <div className="mx-4 mb-4 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

        {/* Nav items */}
        <div className="flex-1 px-2.5 space-y-0.5">
          {NAV.map(({ href, label, icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const isNew  = href === "/claims/new";
            return (
              <Link key={href} href={href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl group"
                style={{
                  background: active ? "rgba(99,102,241,0.12)" : "transparent",
                  color: active ? "#818CF8" : isNew ? "#6366F1" : "rgba(139,149,176,0.8)",
                  fontWeight: active ? 600 : undefined,
                  transition: "background 180ms cubic-bezier(0.25,1,0.5,1), color 150ms cubic-bezier(0.25,1,0.5,1)",
                }}>
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                    style={{
                      background: "#6366F1",
                      height: "1rem",
                      transition: "transform 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease",
                      boxShadow: "2px 0 8px rgba(99,102,241,0.4)",
                    }} />
                )}
                <span className="shrink-0"
                  style={{
                    color: active ? "#818CF8" : isNew ? "#6366F1" : "rgba(74,85,104,0.9)",
                    transition: "color 150ms cubic-bezier(0.25,1,0.5,1)",
                  }}>
                  {icon}
                </span>
                <span className="text-sm truncate" style={{ transition: "color 150ms cubic-bezier(0.25,1,0.5,1)" }}>{label}</span>
                {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                  <span className="ml-auto shrink-0 min-w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1.5"
                    style={{ background: "#F97316", boxShadow: "0 2px 8px rgba(249,115,22,0.4)" }}>
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
                {!active && !isNew && (
                  <svg className="ml-auto shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(139,149,176,0.6)" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom status */}
        <div className="px-3 mt-4">
          <div className="h-px mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="rounded-xl px-3 py-3 flex items-center gap-3"
            style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
            <div className="h-2 w-2 rounded-full shrink-0 animate-live" style={{ background: "#6366F1" }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: "#818CF8" }}>AI System Online</p>
              <p className="text-[10px]" style={{ color: "rgba(99,102,241,0.6)" }}>Claude + Maestro active</p>
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
              className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-150"
              style={active ? { color: "#818CF8", background: "rgba(99,102,241,0.12)" } : { color: "rgba(74,85,104,0.9)" }}>
              {icon}
              <span className="text-[9px] uppercase tracking-wide font-semibold">{label.split(" ")[0]}</span>
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1"
                  style={{ background: "#F97316" }}>
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
