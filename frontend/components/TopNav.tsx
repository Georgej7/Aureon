"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Core destinations stay as direct pill tabs. Everything else -- every
// distinct chart/reading type -- lives under one "Tools" dropdown instead
// of each getting its own top-level tab, the same way astro-seek surfaces
// a dozen-plus calculators from a single "Astro Tools" menu rather than
// flattening them all into the nav bar. "Landing" was dropped as a direct
// tab -- the brand logo already links home, so it was a redundant entry
// crowding the bar.
const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/natal-report", label: "Full reading" },
  { href: "/chat", label: "AI chat" },
  { href: "/compatibility", label: "Compatibility" },
];

// Grouped into labeled sections rather than one flat 15-item list -- also
// naturally clusters the Practitioner-gated items (Solar return, Progressed,
// Composite & Davison, AstroCartography) under "Chart types" instead of
// scattering them alphabetically through everything else, which was its own
// piece of reported feedback ("separate practitioner tools from regular
// customer tools").
const TOOL_SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Manage profile",
    items: [{ href: "/onboarding", label: "Create / edit profile" }],
  },
  {
    label: "Chart types",
    items: [
      { href: "/vedic", label: "Vedic chart" },
      { href: "/solar-return", label: "Solar return" },
      { href: "/progressed", label: "Progressed chart" },
      { href: "/composite", label: "Composite & Davison" },
      { href: "/astrocartography", label: "AstroCartography" },
      { href: "/matrix-of-destiny", label: "Matrix of Destiny" },
    ],
  },
  {
    label: "Systems & draws",
    items: [
      { href: "/human-design", label: "Human Design" },
      { href: "/tarot", label: "Tarot draw" },
      { href: "/chinese-zodiac", label: "Chinese zodiac" },
      { href: "/feng-shui", label: "Feng shui" },
      { href: "/baby-compatibility", label: "Baby compatibility" },
    ],
  },
  {
    label: "Reference & timing",
    items: [
      { href: "/ephemeris", label: "Ephemeris tables" },
      { href: "/aspect-search", label: "Aspect search" },
      { href: "/void-of-course", label: "Void-of-course Moon" },
      { href: "/timing", label: "Financial timing" },
      { href: "/famous-people", label: "Famous people" },
    ],
  },
];
const TOOLS = TOOL_SECTIONS.flatMap((section) => section.items);

const TAIL_TABS = [
  { href: "/clients", label: "Clients" },
  { href: "/pricing", label: "Pricing" },
];

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const toolsActive = TOOLS.some((tool) => tool.href === pathname);

  // Portals need a real document to render into -- guards the SSR pass,
  // where document doesn't exist yet.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!toolsOpen) return;
    // The menu itself is portalled out to document.body (see render below),
    // so it's no longer a DOM descendant of toolsRef -- without also
    // checking toolsMenuRef here, every click on a menu item would
    // register as "outside" and close the menu before the Link's own
    // onClick had a chance to navigate.
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const insideButton = toolsRef.current?.contains(target);
      const insideMenu = toolsMenuRef.current?.contains(target);
      if (!insideButton && !insideMenu) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [toolsOpen]);

  useEffect(() => {
    if (!toolsOpen) return;
    function updatePosition() {
      const rect = toolsButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({ top: rect.bottom + 8, left: rect.left });
    }
    updatePosition();
    // Keeps the portalled menu glued to the button on resize -- it's
    // viewport-fixed now, not parent-relative, so it won't track the
    // button's position automatically the way the old absolute-positioned
    // version did.
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [toolsOpen]);

  useEffect(() => {
    setToolsOpen(false);
  }, [pathname]);

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
        <div className="tools-dropdown" ref={toolsRef}>
          <button
            type="button"
            ref={toolsButtonRef}
            className={`tab${toolsActive ? " active" : ""}`}
            onClick={() => setToolsOpen((open) => !open)}
            aria-expanded={toolsOpen}
          >
            Tools ▾
          </button>
          {toolsOpen &&
            mounted &&
            menuPos &&
            createPortal(
              <div
                className="tools-menu"
                ref={toolsMenuRef}
                style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
              >
                {TOOL_SECTIONS.map((section, i) => (
                  <div key={section.label}>
                    {i > 0 && <div className="tools-menu-divider" />}
                    <div className="tools-menu-heading">{section.label}</div>
                    {section.items.map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className={`tools-menu-item${pathname === tool.href ? " active" : ""}`}
                        onClick={() => setToolsOpen(false)}
                      >
                        {tool.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>,
              document.body
            )}
        </div>
        {TAIL_TABS.map((tab) => (
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
