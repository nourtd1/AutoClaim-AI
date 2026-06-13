import { initDb, getAllClaims } from "@/lib/db";
import type { ClaimStatus } from "@/lib/types";
import ClaimsClient from "./ClaimsClient";
import TopBar from "@/components/TopBar";

initDb();

interface SearchParams { status?: string; }

export default async function ClaimsPage({ searchParams }: { searchParams: SearchParams }) {
  const status = searchParams.status as ClaimStatus | undefined;
  const claims = getAllClaims(status ? { status } : undefined);

  return (
    <div className="min-h-screen">
      <TopBar title="All Claims" subtitle="Search, filter and manage" />

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="animate-fade-up-1">
          <ClaimsClient initialClaims={claims} initialStatus={(status ?? "") as ClaimStatus | ""} />
        </div>
      </main>
    </div>
  );
}
