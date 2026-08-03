"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { href: "/", label: "Landing" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "AI chat" },
  { href: "/compatibility", label: "Compatibility" },
  { href: "/vedic", label: "Vedic" },
  { href: "/feng-shui", label: "Feng shui" },
  { href: "/timing", label: "Timing" },
  { href: "/clients", label: "Clients" },
  { href: "/pricing", label: "Pricing" },
];

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function handleLogOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="topnav print-hide">
      <Link href="/" className="brand">
        <svg className="brand-mark" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
          <circle cx="20" cy="20" r="4" fill="#c9a24a" />
          <circle cx="8" cy="14" r="1.6" fill="#f2ede2" />
          <circle cx="32" cy="27" r="1.6" fill="#f2ede2" />
          <circle cx="30" cy="10" r="1.2" fill="#8a7440" />
        </svg>
        <span className="brand-name">Aureon</span>
      </Link>
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user ? (
          <>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{user.email}</span>
            <button className="btn btn-ghost" onClick={handleLogOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link className="btn btn-ghost" href="/login">
              Log in
            </Link>
            <Link className="btn btn-gold" href="/register">
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
