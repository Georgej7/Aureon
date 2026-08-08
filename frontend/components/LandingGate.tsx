"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Landing-page entrance. Four straight passes at "restyle a click-to-enter
 * button" all still read as a generic splash gate -- restyling the button
 * was never going to fix that, since the button-over-a-scene pattern is
 * itself the generic part. This one changes the mechanic instead: there's
 * no dedicated entry button sitting over the solar system at all. Entry is
 * tied to the interaction the rest of the site already teaches -- clicking
 * a planet or zodiac sign. Starfield.tsx dispatches a window
 * "aureon:sky-click" event on every real hit (see its handleWindowClick);
 * this component just listens for that while the gate is up and treats it
 * as "entered." The only UI is a small caption near the bottom -- an
 * instruction, plus an accessible click/keyboard fallback for anyone who'd
 * rather not go hunting for a planet -- so nothing ever floats over the
 * scene itself.
 *
 * The backdrop is portalled to document.body rather than rendered inline
 * as this component's child -- {children} here lives inside .app, which
 * establishes its own stacking context (see globals.css's note on the
 * Tools dropdown for the same trap). Rendered inline, the backdrop's own
 * z-index only ever wins *within* .app, so a translucent backdrop let the
 * real nav/hero/footer underneath bleed through instead of the Starfield
 * (confirmed live -- looked like a double exposure of the actual site).
 * Portalled + a body class that hides .app and the footer outright while
 * the gate is up, the backdrop sits directly above #starfield/.vignette
 * with nothing else in between.
 *
 * The click-to-enter fades the backdrop away rather than playing a
 * transition over it -- same persistent Starfield scene throughout, never
 * cut to a different one. Shows once per browser session (sessionStorage).
 */

type Phase = "gate" | "arrived";

const SESSION_KEY = "aureon_entered";
const FADE_MS = 700;

export default function LandingGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("gate");
  const [hintVisible, setHintVisible] = useState(false);
  const [backdropOpacity, setBackdropOpacity] = useState(1);
  const [mounted, setMounted] = useState(false);
  const gateBtnRef = useRef<HTMLButtonElement | null>(null);

  // Runs before paint so a returning visitor never sees the gate flash in.
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") {
        setBackdropOpacity(0);
        setPhase("arrived");
      }
    } catch {
      // sessionStorage unavailable (private browsing etc.) — gate just shows every time.
    }
  }, []);

  // Portals need a real document to render into -- guards the SSR pass.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("gate-active", phase !== "arrived");
    return () => document.body.classList.remove("gate-active");
  }, [phase]);

  useEffect(() => {
    if (phase !== "gate") return;
    gateBtnRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setHintVisible(true), 2600);
    return () => clearTimeout(timer);
  }, [phase]);

  function enter() {
    if (phase !== "gate") return;
    setBackdropOpacity(0);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // fine — worst case the gate shows again next load
    }
    setTimeout(() => setPhase("arrived"), FADE_MS);
  }

  // The actual entrance mechanic: any real click Starfield registers
  // against a planet or zodiac sign counts as "entered."
  useEffect(() => {
    if (phase !== "gate") return;
    window.addEventListener("aureon:sky-click", enter);
    return () => window.removeEventListener("aureon:sky-click", enter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <>
      {children}
      {mounted &&
        phase !== "arrived" &&
        createPortal(
          <div
            className="landing-gate-backdrop"
            style={{ opacity: backdropOpacity }}
            aria-hidden={phase !== "gate"}
          >
            <button
              ref={gateBtnRef}
              type="button"
              className="landing-gate-point"
              aria-label="Enter Aureon"
              onClick={enter}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  enter();
                }
              }}
            >
              <span className="landing-gate-phase serif">Find something in the sky</span>
              <span className={`landing-gate-hint${hintVisible ? " visible" : ""}`}>
                Click a planet, a zodiac sign — or press Enter
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
