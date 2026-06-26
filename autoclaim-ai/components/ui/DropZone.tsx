"use client";

import { useCallback, useRef, useState } from "react";
import type { Claim } from "@/lib/types";

type Source = "PDF" | "EMAIL";

interface UploadResult {
  claim: Claim;
  document: { id: string; filename: string; fileSize: number };
  message: string;
}

interface DropZoneProps {
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onSuccess, onError }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<Source>("EMAIL");
  const [policyNumber, setPolicyNumber] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setProgress(0); setResult(null); setError(null); };

  const acceptFile = (f: File) => {
    setError(null); setResult(null); setProgress(0);
    setSource(f.name.endsWith(".pdf") || f.type === "application/pdf" ? "PDF" : "EMAIL");
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }, []);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) acceptFile(f); };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setError(null); setResult(null); setProgress(10);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("source", source);
    if (policyNumber.trim()) fd.append("policyNumber", policyNumber.trim());
    try {
      const ticker = setInterval(() => setProgress((p) => (p < 85 ? p + 10 : p)), 400);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      clearInterval(ticker);
      setProgress(95);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Upload failed (${res.status})`);
      setProgress(100);
      const uploadResult = json.data as UploadResult;
      setResult(uploadResult);
      onSuccess?.(uploadResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown upload error";
      setError(msg); onError?.(msg); setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Drop zone */}
      <div
        role="button" tabIndex={0} aria-label="File upload area"
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !file && inputRef.current?.click()}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        className="relative flex flex-col items-center justify-center rounded-xl px-6 py-10 transition-all duration-200"
        style={{
          background: isDragging ? "rgba(99,102,241,0.1)" : file ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)",
          border: `2px dashed ${isDragging ? "rgba(99,102,241,0.5)" : file ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.1)"}`,
          cursor: file ? "default" : "pointer",
        }}>
        <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only" onChange={onInputChange} disabled={uploading} />

        {file ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-3xl">{source === "PDF" ? "📄" : "✉️"}</span>
            <p className="font-medium break-all" style={{ color: "#E8EBF4" }}>{file.name}</p>
            <p className="text-sm" style={{ color: "#8B95B0" }}>{formatBytes(file.size)}</p>
            <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-1 text-xs transition-colors hover:opacity-80" style={{ color: "#F87171" }} disabled={uploading}>
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-1"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(129,140,248,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="font-medium text-sm" style={{ color: "#E8EBF4" }}>Drag &amp; drop a PDF or email (.txt)</p>
            <p className="text-xs" style={{ color: "#4A5568" }}>or click to browse — max 10 MB</p>
          </div>
        )}
      </div>

      {/* Options */}
      {file && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium w-20 shrink-0" style={{ color: "#8B95B0" }}>Source</label>
            <div className="flex gap-2">
              {(["PDF", "EMAIL"] as Source[]).map((s) => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all duration-150"
                  style={source === s
                    ? { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#818CF8" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#8B95B0" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="policyNumber" className="text-xs font-medium w-20 shrink-0" style={{ color: "#8B95B0" }}>Policy #</label>
            <input id="policyNumber" type="text" placeholder="Optional — extracted if blank"
              value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} disabled={uploading}
              className="flex-1 input-dark text-sm px-3 py-1.5" />
          </div>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#6366F1,#818CF8)", boxShadow: "0 0 8px rgba(99,102,241,0.4)" }} />
          </div>
          <p className="text-xs text-right font-mono-id tabular-nums" style={{ color: "#4A5568" }}>{progress}%</p>
        </div>
      )}

      {/* Upload button */}
      {file && !result && (
        <button type="button" onClick={upload} disabled={uploading}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 transition-all duration-200 btn-primary">
          {uploading ? "Uploading…" : "Upload & Process"}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171" }}>
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="text-sm font-semibold" style={{ color: "#34D399" }}>{result.message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "#8B95B0" }}>
            <span className="font-medium">Claim ID:</span>
            <span className="font-mono-id">{result.claim.id.slice(0, 8)}…</span>
            <span className="font-medium">Policy:</span>
            <span>{result.claim.policyNumber}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium" style={{ color: "#8B95B0" }}>Status:</span>
            <span className="rounded-full px-2 py-0.5 font-semibold"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34D399" }}>
              {result.claim.status}
            </span>
          </div>
          <button type="button" onClick={reset}
            className="mt-1 text-xs transition-colors hover:opacity-80" style={{ color: "#6366F1" }}>
            Upload another file
          </button>
        </div>
      )}
    </div>
  );
}
