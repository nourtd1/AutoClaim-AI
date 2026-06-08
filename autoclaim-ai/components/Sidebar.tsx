"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/",           label: "Dashboard",    icon: "◈", exact: true },
  { href: "/claims",     label: "All Claims",   icon: "⊞" },
  { href: "/review",     label: "Review Queue", icon: "⚑" },
  { href: "/claims/new", label: "Submit New",   icon: "＋", exact: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/review/stats")
      .then((r) => r.json())
      .then((j) => { if (typeof j?.data?.pending === "number") setPendingCount(j.data.pending); })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-14 flex-col items-center border-r border-white/[0.06] bg-[#0a0c10] py-4 gap-1 z-30">
        {/* Logo mark */}
        <Link href="/" className="mb-3 h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
          AC
        </Link>

        {NAV.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-lg transition-colors ${
                active
                  ? "bg-violet-900/60 text-violet-200"
                  : "text-slate-600 hover:bg-white/[0.05] hover:text-slate-300"
              }`}
            >
              {icon}
              {/* Badge on Review Queue */}
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-orange-500 text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-white/[0.06] bg-[#0a0c10] px-2 py-2">
        {NAV.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active ? "text-violet-300" : "text-slate-600 hover:text-slate-300"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[9px] uppercase tracking-wide">{label}</span>
              {href === "/review" && pendingCount !== null && pendingCount > 0 && (
                <span className="absolute top-1 right-1 h-3.5 min-w-3.5 rounded-full bg-orange-500 text-[8px] font-bold text-white flex items-center justify-center px-0.5">
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
