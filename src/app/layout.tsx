import type { Metadata } from "next";
import { Funnel_Sans, Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const funnelSans = Funnel_Sans({
  variable: "--font-funnel-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "R1 AI Market Deck",
  description:
    "A Meeker-style narrative deck on AI adoption across R1 universities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${funnelSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="min-h-screen font-primary">{children}</body>
    </html>
  );
}
