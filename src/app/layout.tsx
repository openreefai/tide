import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Nav from "@/components/nav";
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
  title: "Tide — OpenReef Formation Registry",
  description:
    "Discover, share, and install multi-agent formations for the OpenReef ecosystem. Browse solo agents, shoals, and schools.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-white focus:text-sm">
          Skip to content
        </a>
        <Nav />
        <main id="main-content" className="min-h-screen">{children}</main>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
      <GoogleAnalytics gaId="G-X722JV1KD0" />
    </html>
  );
}
