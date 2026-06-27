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
  info:    { bg: "oklch(0.70 0.17 230 / 0.10)", border: "oklch(0.70 0.17 230 / 0.28)", color: "oklch(0.75 0.13 230)" },
  success: { bg: "oklch(0.72 0.18 142 / 0.10)", border: "oklch(0.72 0.18 142 / 0.28)", color: "oklch(0.82 0.16 142)" },
  warning: { bg: "oklch(0.80 0.13 78 / 0.10)",  border: "oklch(0.80 0.13 78 / 0.28)",  color: "oklch(0.88 0.11 78)" },
  error:   { bg: "oklch(0.68 0.22 22 / 0.10)",  border: "oklch(0.68 0.22 22 / 0.28)",  color: "oklch(0.76 0.18 22)" },
};

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const s = TYPE_STYLE[msg.type ?? "info"] ?? TYPE_STYLE.info!;

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm max-w-sm"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        animation: "toast-in 0.22s var(--ease-out-expo) forwards",
        backdropFilter: "blur(16px)",
        boxShadow: "0 8px 32px oklch(0 0 0 / 0.50)",
      }}>
      <p className="flex-1" style={{ color: "oklch(0.93 0.005 140)" }}>{msg.message}</p>
      <button onClick={onDismiss}
        aria-label="Dismiss notification"
        className="transition-opacity hover:opacity-100 opacity-45 text-lg leading-none"
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
