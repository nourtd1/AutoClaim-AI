import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Backgrounds — slate-950 family (softer than pure black) ── */
        bg:          "oklch(0.115 0.012 250)",
        surface:     "oklch(0.148 0.013 250)",
        "surface-2": "oklch(0.182 0.013 250)",
        "surface-3": "oklch(0.218 0.012 250)",

        /* ── Text ── */
        text:    "oklch(0.93 0.008 250)",
        "text-2": "oklch(0.65 0.012 250)",
        "text-3": "oklch(0.58 0.010 250)",
        "text-4": "oklch(0.50 0.008 250)",

        /* ── Brand green — primary accent, slightly cooler ── */
        green: {
          DEFAULT: "oklch(0.70 0.17 155)",
          bright:  "oklch(0.80 0.15 155)",
          dim:     "oklch(0.70 0.17 155 / 0.12)",
          border:  "oklch(0.70 0.17 155 / 0.30)",
          glow:    "oklch(0.70 0.17 155 / 0.20)",
        },

        /* ── Azure — secondary accent (AI/data emphasis) ── */
        azure: {
          DEFAULT: "oklch(0.68 0.18 232)",
          bright:  "oklch(0.78 0.15 232)",
          dim:     "oklch(0.68 0.18 232 / 0.12)",
          border:  "oklch(0.68 0.18 232 / 0.30)",
          glow:    "oklch(0.68 0.18 232 / 0.20)",
        },

        /* ── Amber — warnings, human actions ── */
        amber: {
          DEFAULT: "oklch(0.80 0.13 78)",
          dim:     "oklch(0.80 0.13 78 / 0.13)",
          border:  "oklch(0.80 0.13 78 / 0.28)",
        },

        /* ── Backward compat aliases ── */
        indigo:  { DEFAULT: "oklch(0.68 0.18 232)", 400: "oklch(0.78 0.15 232)", 500: "oklch(0.68 0.18 232)" },
        emerald: { DEFAULT: "oklch(0.70 0.17 155)", 400: "oklch(0.80 0.15 155)", 500: "oklch(0.70 0.17 155)" },
        orange:  { DEFAULT: "oklch(0.80 0.13 78)",  400: "oklch(0.88 0.11 78)",  500: "oklch(0.80 0.13 78)" },
        rose:    { DEFAULT: "oklch(0.68 0.22 22)",  400: "oklch(0.76 0.18 22)",  500: "oklch(0.68 0.22 22)" },
        violet:  { DEFAULT: "oklch(0.68 0.18 232)", 400: "oklch(0.78 0.15 232)" },

        /* ── Structural borders ── */
        border:          "oklch(1.00 0.000 0 / 0.08)",
        "border-mid":    "oklch(1.00 0.000 0 / 0.14)",
        "border-strong": "oklch(1.00 0.000 0 / 0.24)",
      },
      fontFamily: {
        sans:  ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:  ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "0.75rem",
        xl3: "1rem",
        xl4: "1.25rem",
      },
      boxShadow: {
        card:       "0 1px 4px oklch(0 0 0 / 0.30), 0 2px 16px oklch(0 0 0 / 0.28)",
        "card-md":  "0 2px 8px oklch(0 0 0 / 0.40), 0 4px 28px oklch(0 0 0 / 0.36)",
        "card-lg":  "0 4px 16px oklch(0 0 0 / 0.50), 0 8px 48px oklch(0 0 0 / 0.44)",
        green:      "0 2px 12px oklch(0.70 0.17 155 / 0.32)",
        "green-lg": "0 4px 24px oklch(0.70 0.17 155 / 0.38)",
        azure:      "0 2px 12px oklch(0.68 0.18 232 / 0.32)",
        "azure-lg": "0 4px 24px oklch(0.68 0.18 232 / 0.38)",
        amber:      "0 2px 12px oklch(0.80 0.13 78 / 0.30)",
        /* backward compat */
        indigo:     "0 2px 12px oklch(0.68 0.18 232 / 0.32)",
        "indigo-lg":"0 4px 24px oklch(0.68 0.18 232 / 0.38)",
        emerald:    "0 2px 12px oklch(0.70 0.17 155 / 0.28)",
      },
      animation: {
        "status-pulse": "status-pulse 1.8s ease-in-out infinite",
        "critical":     "critical-blink 0.85s steps(1) infinite",
        "fade-up":      "fade-up 0.32s cubic-bezier(0.16,1,0.3,1) both",
        "live":         "live-dot 1.8s ease-out infinite",
        "live-emerald": "live-dot-emerald 1.8s ease-out infinite",
        "live-amber":   "live-dot-amber 1.8s ease-out infinite",
        "shimmer":      "shimmer 1.6s infinite",
        "glow":         "glow-pulse 2.5s ease-in-out infinite",
        "signal":       "signal-sweep 2.4s cubic-bezier(0.22,1,0.36,1) infinite",
      },
      keyframes: {
        "status-pulse":     { "0%,100%": { opacity:"1" }, "50%": { opacity:"0.30" } },
        "critical-blink":   { "0%,100%": { opacity:"1" }, "50%": { opacity:"0.18" } },
        "fade-up":          { from:{ opacity:"0", transform:"translateY(8px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "live-dot":         { "0%":{ boxShadow:"0 0 0 0 oklch(0.70 0.17 155 / 0.70)" }, "70%":{ boxShadow:"0 0 0 5px oklch(0.70 0.17 155 / 0.00)" }, "100%":{ boxShadow:"0 0 0 0 oklch(0.70 0.17 155 / 0.00)" } },
        "live-dot-emerald": { "0%":{ boxShadow:"0 0 0 0 oklch(0.70 0.17 155 / 0.70)" }, "70%":{ boxShadow:"0 0 0 5px oklch(0.70 0.17 155 / 0.00)" }, "100%":{ boxShadow:"0 0 0 0 oklch(0.70 0.17 155 / 0.00)" } },
        "live-dot-amber":   { "0%":{ boxShadow:"0 0 0 0 oklch(0.80 0.13 78 / 0.65)" }, "70%":{ boxShadow:"0 0 0 5px oklch(0.80 0.13 78 / 0.00)" }, "100%":{ boxShadow:"0 0 0 0 oklch(0.80 0.13 78 / 0.00)" } },
        shimmer:            { "0%":{ backgroundPosition:"-200% 0" }, "100%":{ backgroundPosition:"200% 0" } },
        "glow-pulse":       { "0%,100%": { opacity:"0.55" }, "50%": { opacity:"1" } },
        "signal-sweep":     { from:{ transform:"translateX(-100%)" }, to:{ transform:"translateX(100%)" } },
      },
    },
  },
  plugins: [],
};
export default config;
