import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col items-center justify-center gap-6 text-center px-6">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-40">
        <path d="M32 8L56 52H8L32 8Z" stroke="#7C3AED" strokeWidth="3" strokeLinejoin="round" fill="none"/>
        <path d="M32 28V38" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="32" cy="45" r="2" fill="#7C3AED"/>
      </svg>
      <div>
        <p className="font-mono-id text-6xl font-bold text-slate-800">404</p>
        <p className="text-slate-400 mt-2 text-sm">Page not found</p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors px-5 py-2.5 text-sm font-semibold text-white"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}
