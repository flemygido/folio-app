import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import { WidgetClient } from "@/components/widget-client";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Folio — AI Work Assistant",
  description: "Your calm, intelligent AI assistant for email, calendar, and focus.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Folio",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="bg-[#020b18] text-slate-200 antialiased">
        {children}
        <WidgetClient />
      </body>
    </html>
  );
}
