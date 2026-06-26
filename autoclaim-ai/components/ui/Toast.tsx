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

const TYPE_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  info:    { bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)",  color: "#60A5FA" },
  success: { bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)",  color: "#34D399" },
  warning: { bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)",  color: "#FB923C" },
  error:   { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   color: "#F87171" },
};

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const s = TYPE_STYLE[msg.type ?? "info"] ?? { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#60A5FA" };

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm max-w-sm"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, animation: "toast-in 0.25s ease forwards", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      <p className="flex-1" style={{ color: "#E8EBF4" }}>{msg.message}</p>
      <button onClick={onDismiss} className="transition-opacity hover:opacity-100 opacity-50 text-lg leading-none"
        style={{ color: s.color }}>×</button>
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
