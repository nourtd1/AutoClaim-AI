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
        bg: "#F1F5F9",
        surface: "#FFFFFF",
        indigo: {
          DEFAULT: "#4F46E5",
          50:  "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          950: "#1E1B4B",
        },
        violet: {
          DEFAULT: "#7C3AED",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          950: "#2E1065",
        },
        emerald: {
          DEFAULT: "#10B981",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          950: "#022C22",
        },
        orange: {
          DEFAULT: "#F97316",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          950: "#431407",
        },
        border: "#E2E8F0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem",
        xl4: "1.5rem",
      },
      boxShadow: {
        card:        "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md":   "0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
        "card-lg":   "0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)",
        "indigo":    "0 4px 14px rgba(79,70,229,0.25)",
        "indigo-lg": "0 8px 28px rgba(79,70,229,0.3)",
      },
      animation: {
        "status-pulse":  "status-pulse 1.8s ease-in-out infinite",
        "critical":      "critical-blink 0.9s steps(1) infinite",
        "fade-up":       "fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "live":          "live-dot 1.6s ease-out infinite",
        "shimmer":       "shimmer 1.6s infinite",
      },
      keyframes: {
        "status-pulse":  { "0%,100%": { opacity:"1" }, "50%": { opacity:"0.4" } },
        "critical-blink":{ "0%,100%": { opacity:"1" }, "50%": { opacity:"0.25" } },
        "fade-up":       { from:{ opacity:"0", transform:"translateY(16px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "live-dot":      { "0%":{ boxShadow:"0 0 0 0 rgba(79,70,229,0.5)" }, "70%":{ boxShadow:"0 0 0 5px rgba(79,70,229,0)" }, "100%":{ boxShadow:"0 0 0 0 rgba(79,70,229,0)" } },
        shimmer:         { "0%":{ backgroundPosition:"-200% 0" }, "100%":{ backgroundPosition:"200% 0" } },
      },
    },
  },
  plugins: [],
};
export default config;
