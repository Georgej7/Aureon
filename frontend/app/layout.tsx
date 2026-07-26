import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import Link from "next/link";
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
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>
        <Starfield />
        <div className="vignette" />
        <div className="app">
          <TopNav />
          {children}
        </div>
        <footer className="site-footer">
          <span>© {new Date().getFullYear()} Aureon</span>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="mailto:georgejermizashvili@gmail.com">Support</a>
        </footer>
      </body>
    </html>
  );
}
