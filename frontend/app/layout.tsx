import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
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
      </body>
    </html>
  );
}
