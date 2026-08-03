import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Analytics from "@/components/Analytics";
import BfcacheGuard from "@/components/BfcacheGuard";
import Starfield from "@/components/Starfield";
import TopNav from "@/components/TopNav";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-manrope",
});

// Real chart data (degrees, timestamps) reads in this instead of the body
// sans -- part of "The Orrery" direction, see globals.css .mono.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Aureon",
  description: "The sky keeps moving. So do you. Aureon is what keeps track.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable}`}>
      <body>
        <Analytics />
        <BfcacheGuard />
        <Starfield />
        <div className="vignette" />
        <div className="app">
          <TopNav />
          {children}
        </div>
        <footer className="site-footer print-hide">
          <span>© {new Date().getFullYear()} Aureon</span>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:georgejermizashvili@gmail.com">Support</a>
        </footer>
      </body>
    </html>
  );
}
