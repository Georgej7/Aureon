"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Landing" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "AI chat" },
  { href: "/pricing", label: "Pricing" },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <div className="topnav">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
          <circle cx="20" cy="20" r="4" fill="#c9a24a" />
          <circle cx="8" cy="14" r="1.6" fill="#f2ede2" />
          <circle cx="32" cy="27" r="1.6" fill="#f2ede2" />
          <circle cx="30" cy="10" r="1.2" fill="#8a7440" />
        </svg>
        <span className="brand-name">Aureon</span>
      </div>
      <div className="tabs">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab${pathname === tab.href ? " active" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
