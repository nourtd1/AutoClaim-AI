"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    href: "/", label: "Dashboard", exact: true,
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    href: "/claims", label: "Claims",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    href: "/review", label: "Review Queue",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  },
  {
    href: "/claims/new", label: "New Claim", exact: true,
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
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
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-52 flex-col py-5 z-30"
        style={{ background:"#FFFFFF", borderRight:"1px solid #E2E8F0", boxShadow:"1px 0 0 #E2E8F0" }}>

        {/* Logo */}
        <div className="px-4 mb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
              style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)", boxShadow:"0 2px 8px rgba(79,70,229,0.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h4l2-6 2 12 2-8 1 4h5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color:"#1E293B" }}>
                AutoClaim <span style={{ color:"#4F46E5" }}>AI</span>
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color:"#94A3B8" }}>UiPath AgentHack</p>
            </div>
          </Link>
        </div>

        <div className="mx-4 mb-3 h-px" style={{ background:"#F1F5F9" }} />

        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color:"#94A3B8" }}>
          Navigation
        </p>

        {/* Nav items */}
        <div className="flex-1 px-3 space-y-0.5">
          {NAV.map(({ href, label, icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const isNew  = href === "/claims/new";
            return (
              <Link key={href} href={href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
                style={active ? {
                  background:"#EEF2FF",
                  color:"#4F46E5",
                  fontWeight:600,
                } : isNew ? {
                  color:"#4F46E5",
                  background:"transparent",
                } : {
                  color:"#64748B",
                  background:"transparent",
                }}>
                {/* Active left indicator */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background:"#4F46E5" }} />
                )}
                <span className="shrink-0" style={{ color: active ? "#4F46E5" : isNew ? "#4F46E5" : "#94A3B8" }}>{icon}</span>
                <span className="text-sm truncate">{label}</span>
                {/* Badge */}
                {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                  <span className="ml-auto shrink-0 min-w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1.5"
                    style={{ background:"#F97316" }}>
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
                {/* Arrow on hover */}
                {!active && (
                  <svg className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom status card */}
        <div className="px-4 mt-4">
          <div className="h-px mb-3" style={{ background:"#F1F5F9" }} />
          <div className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{ background:"#EEF2FF", border:"1px solid #C7D2FE" }}>
            <div className="h-2 w-2 rounded-full shrink-0 animate-live" style={{ background:"#4F46E5" }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color:"#4F46E5" }}>AI System Online</p>
              <p className="text-[10px]" style={{ color:"#818CF8" }}>Claude + Maestro active</p>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2"
        style={{ background:"#FFFFFF", borderTop:"1px solid #E2E8F0", boxShadow:"0 -1px 0 #E2E8F0" }}>
        {NAV.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-150"
              style={active ? { color:"#4F46E5", background:"#EEF2FF" } : { color:"#94A3B8" }}>
              {icon}
              <span className="text-[9px] uppercase tracking-wide font-semibold">{label.split(" ")[0]}</span>
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1"
                  style={{ background:"#F97316" }}>
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
