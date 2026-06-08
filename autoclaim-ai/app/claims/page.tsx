import Link from "next/link";
import { initDb, getAllClaims } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import ClaimsClient from "./ClaimsClient";

initDb();

interface SearchParams {
  status?: string;
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const status = searchParams.status as ClaimStatus | undefined;
  const claims = getAllClaims(status ? { status } : undefined);

  return (
    <div className="min-h-screen bg-[#0F1117]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">AC</div>
              <span className="font-semibold text-slate-100 text-sm">AutoClaim <span className="text-emerald-400">AI</span></span>
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-400">Claims</span>
          </div>
          <Link
            href="/claims/new"
            className="rounded-lg bg-emerald-500 hover:bg-emerald-400 transition-colors px-3 py-1.5 text-xs font-semibold text-white"
          >
            + New Claim
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* ── Page title ── */}
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Claims</h1>
          <p className="text-xs text-slate-500 mt-0.5">All insurance claims — search, filter and manage</p>
        </div>

        <ClaimsClient
          initialClaims={claims}
          initialStatus={(status ?? "") as ClaimStatus | ""}
        />
      </main>
    </div>
  );
}
