import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AccountCast Dashboard",
  description: "PMF experiments & growth dashboard — 9 campaigns, 4 deals in pipeline, tracking toward 80% PMF",
  openGraph: {
    title: "AccountCast Dashboard",
    description: "PMF experiments & growth dashboard — 9 campaigns, 4 deals in pipeline",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AccountCast Dashboard",
    description: "PMF experiments & growth dashboard",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
