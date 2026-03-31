import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, Playfair_Display } from "next/font/google";

import { SidebarShell } from "@/components/layout/sidebar-shell";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Lead Intelligence Engine",
  description:
    "Apollo-first lead intelligence dashboard for discovery, enrichment, extraction, and evidence-backed outreach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfairDisplay.variable} ${dmSans.variable} ${dmSerifDisplay.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SidebarShell>{children}</SidebarShell>
      </body>
    </html>
  );
}
