"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    href: "/", label: "Dashboard", exact: true,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
  },
  {
    href: "/claims/new", label: "New Claim", exact: true,
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <nav
        className="hidden md:flex fixed left-0 top-0 h-full w-52 flex-col py-5 z-30"
        style={{
          background: "linear-gradient(180deg, rgba(15,8,28,0.98) 0%, rgba(10,5,20,0.98) 100%)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(168,85,247,0.18)",
        }}
      >
        {/* ── Logo / Brand ── */}
        <div className="px-4 mb-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #A855F7 0%, #7C3AED 50%, #EC4899 100%)",
                boxShadow: "0 0 20px rgba(168,85,247,0.55), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M4 12h4l2-6 2 12 2-8 1 4h5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: "#FAF5FF" }}>
                AutoClaim <span style={{
                  background: "linear-gradient(90deg, #A855F7, #EC4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>AI</span>
              </p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: "rgba(168,85,247,0.55)" }}>
                UiPath AgentHack
              </p>
            </div>
          </Link>
        </div>

        {/* ── Divider ── */}
        <div className="mx-4 mb-3" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)" }} />

        {/* ── Nav label ── */}
        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.4)" }}>
          Navigation
        </p>

        {/* ── Nav items ── */}
        <div className="flex-1 px-3 space-y-1">
          {NAV.map(({ href, label, icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            const isNew = href === "/claims/new";

            return (
              <Link
                key={href}
                href={href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
                style={active ? {
                  background: "linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(124,58,237,0.14) 100%)",
                  border: "1px solid rgba(168,85,247,0.38)",
                  boxShadow: "0 0 20px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
                  color: "#E9D5FF",
                } : isNew ? {
                  background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.08))",
                  border: "1px solid rgba(168,85,247,0.22)",
                  color: "#C084FC",
                } : {
                  background: "transparent",
                  border: "1px solid transparent",
                  color: "rgba(196,181,253,0.55)",
                }}
              >
                {/* Active left bar */}
                {active && (
                  <span
                    className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: "linear-gradient(180deg, #A855F7, #EC4899)" }}
                  />
                )}

                {/* Icon */}
                <span
                  className="shrink-0 transition-all duration-200"
                  style={active ? {
                    color: "#C084FC",
                    filter: "drop-shadow(0 0 6px rgba(168,85,247,0.7))",
                  } : isNew ? {
                    color: "#A855F7",
                  } : {
                    color: "rgba(196,181,253,0.55)",
                  }}
                >
                  {icon}
                </span>

                {/* Label */}
                <span className="text-sm font-medium truncate transition-colors duration-200"
                  style={active ? { color: "#E9D5FF", fontWeight: 600 }
                    : isNew ? { color: "#C084FC" }
                    : { color: "rgba(196,181,253,0.55)" }}>
                  {label}
                </span>

                {/* Badge */}
                {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                  <span
                    className="ml-auto shrink-0 min-w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1.5"
                    style={{
                      background: "linear-gradient(135deg, #EC4899, #BE185D)",
                      boxShadow: "0 0 10px rgba(236,72,153,0.55)",
                    }}
                  >
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}

                {/* Arrow on hover (inactive) */}
                {!active && (
                  <svg
                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -translate-x-1 group-hover:translate-x-0"
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ color: "rgba(168,85,247,0.5)", transition: "all 200ms" }}
                  >
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                )}
              </Link>
            );
          })}
        </div>

        {/* ── Bottom section ── */}
        <div className="px-4 mt-4">
          <div className="mb-3" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)" }} />

          {/* AI Status card */}
          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.18)",
            }}
          >
            <div
              className="h-2 w-2 rounded-full shrink-0 animate-live"
              style={{ background: "#A855F7" }}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold" style={{ color: "#C084FC" }}>AI System Online</p>
              <p className="text-[10px]" style={{ color: "rgba(168,85,247,0.45)" }}>Claude + Maestro active</p>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around px-2 py-2"
        style={{
          background: "rgba(10,5,20,0.98)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(168,85,247,0.18)",
        }}
      >
        {NAV.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200"
              style={active ? {
                color: "#C084FC",
                background: "rgba(168,85,247,0.15)",
                border: "1px solid rgba(168,85,247,0.28)",
              } : {
                color: "rgba(196,181,253,0.45)",
                border: "1px solid transparent",
              }}
            >
              <span style={active ? { filter: "drop-shadow(0 0 4px rgba(168,85,247,0.7))" } : {}}>
                {icon}
              </span>
              <span className="text-[9px] uppercase tracking-wide font-semibold">{label.split(" ")[0]}</span>
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center px-1"
                  style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)" }}
                >
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
