import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AutoClaim AI | UiPath AgentHack 2026",
    template: "%s | AutoClaim AI",
  },
  description:
    "AI-powered insurance claims automation with UiPath Maestro Case orchestration — built for UiPath AgentHack 2026.",
  keywords: ["insurance", "claims", "automation", "UiPath", "Maestro", "AI", "Claude"],
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
  ],
  openGraph: {
    title: "AutoClaim AI | UiPath AgentHack 2026",
    description: "AI-powered insurance claims automation with UiPath Maestro Case orchestration.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistMono.variable} ${inter.variable}`}>
      <body className="antialiased">
        <Sidebar />
        <div className="md:pl-14 pb-16 md:pb-0">
          {children}
        </div>
      </body>
    </html>
  );
}
