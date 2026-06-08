"use client";

import { useEffect } from "react";

export interface ToastMessage {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TYPE_STYLE: Record<string, string> = {
  info:    "border-blue-700   bg-blue-950   text-blue-200",
  success: "border-emerald-700 bg-emerald-950 text-emerald-200",
  warning: "border-orange-700  bg-orange-950  text-orange-200",
  error:   "border-red-700    bg-red-950    text-red-200",
};

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const style = TYPE_STYLE[msg.type ?? "info"] ?? TYPE_STYLE["info"];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl text-sm max-w-sm ${style}`}
      style={{ animation: "toast-in 0.25s ease forwards" }}
    >
      <p className="flex-1">{msg.message}</p>
      <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">×</button>
    </div>
  );
}

export default function ToastContainer({ messages, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      {messages.map((m) => (
        <ToastItem key={m.id} msg={m} onDismiss={() => onDismiss(m.id)} />
      ))}
    </div>
  );
}

// ── Global toast keyframe (injected once) ─────────────────────────────────────

export function ToastStyles() {
  return (
    <style>{`
      @keyframes toast-in {
        from { opacity: 0; transform: translateX(1rem) scale(0.96); }
        to   { opacity: 1; transform: translateX(0)    scale(1); }
      }
    `}</style>
  );
}
