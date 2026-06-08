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

function statusColor(status: string): string {
  const map: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    EXTRACTING: "bg-yellow-100 text-yellow-800",
    VALIDATING: "bg-yellow-100 text-yellow-800",
    PENDING_REVIEW: "bg-orange-100 text-orange-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    ESCALATED: "bg-purple-100 text-purple-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
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

  const reset = () => {
    setFile(null);
    setProgress(0);
    setResult(null);
    setError(null);
  };

  const acceptFile = (f: File) => {
    setError(null);
    setResult(null);
    setProgress(0);
    // Infer source from extension
    if (f.name.endsWith(".pdf") || f.type === "application/pdf") {
      setSource("PDF");
    } else {
      setSource("EMAIL");
    }
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }, []);

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
  };

  const upload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);
    setProgress(10);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("source", source);
    if (policyNumber.trim()) fd.append("policyNumber", policyNumber.trim());

    try {
      // Simulate progress ticks while the real fetch is running
      const ticker = setInterval(() => {
        setProgress((p) => (p < 85 ? p + 10 : p));
      }, 400);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      clearInterval(ticker);
      setProgress(95);

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `Upload failed (${res.status})`);
      }

      setProgress(100);
      const uploadResult = json.data as UploadResult;
      setResult(uploadResult);
      onSuccess?.(uploadResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown upload error";
      setError(msg);
      onError?.(msg);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="File upload area"
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !file && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : file
            ? "border-green-400 bg-green-50 cursor-default"
            : "border-gray-300 bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={onInputChange}
          disabled={uploading}
        />

        {file ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-3xl">{source === "PDF" ? "📄" : "✉️"}</span>
            <p className="font-medium text-gray-800 break-all">{file.name}</p>
            <p className="text-sm text-gray-500">{formatBytes(file.size)}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="mt-1 text-xs text-red-500 hover:underline"
              disabled={uploading}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="text-4xl text-gray-400">📂</span>
            <p className="font-medium text-gray-700">
              Drag &amp; drop a PDF or email (.txt)
            </p>
            <p className="text-sm text-gray-400">or click to browse — max 10 MB</p>
          </div>
        )}
      </div>

      {/* Options row */}
      {file && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 w-20 shrink-0">Source</label>
            <div className="flex gap-2">
              {(["PDF", "EMAIL"] as Source[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    source === s
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:border-blue-400",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="policyNumber"
              className="text-sm font-medium text-gray-700 w-20 shrink-0"
            >
              Policy #
            </label>
            <input
              id="policyNumber"
              type="text"
              placeholder="Optional — extracted if blank"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              disabled={uploading}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100"
            />
          </div>
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">{progress}%</p>
        </div>
      )}

      {/* Upload button */}
      {file && !result && (
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload & Process"}
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success result card */}
      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-800">{result.message}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-medium">Claim ID:</span>
            <span className="font-mono">{result.claim.id.slice(0, 8)}…</span>
            <span className="font-medium">Policy:</span>
            <span>{result.claim.policyNumber}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-600">Status:</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${statusColor(result.claim.status)}`}>
              {result.claim.status}
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            Upload another file
          </button>
        </div>
      )}
    </div>
  );
}
