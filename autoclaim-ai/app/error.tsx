"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center gap-6 text-center px-6">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="opacity-50">
        <circle cx="28" cy="28" r="24" stroke="#EF4444" strokeWidth="3" fill="none"/>
        <path d="M28 18V30" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="28" cy="37" r="2" fill="#EF4444"/>
      </svg>
      <div>
        <p className="text-slate-200 font-semibold text-lg">Something went wrong</p>
        <p className="text-slate-500 text-xs mt-1 font-mono-id break-all max-w-sm">
          {error.message ?? "An unexpected error occurred"}
        </p>
        {error.digest && (
          <p className="text-slate-700 text-[10px] mt-1 font-mono-id">digest: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-white/10 hover:border-white/20 transition-colors px-4 py-2 text-sm text-slate-400"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
