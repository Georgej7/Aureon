"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getMoonPhase } from "@/lib/moonPhase";

/**
 * Cinematic entrance for the landing page: instead of a generic "click to
 * begin" prompt, the click target itself shows tonight's actual Moon phase
 * and illumination -- real, changes every day, and ties the very first
 * thing a visitor sees to what the product actually does (real
 * astronomical data), rather than decorative copy. Sits over the Sun's
 * position in the already-running Starfield behind it. Click/keyboard-
 * activated -- the backdrop just fades away on click, revealing the same
 * scene that's been animating underneath the whole time rather than
 * cutting to a different one or playing a separate transition over it.
 * Shows once per browser session (sessionStorage), not on every visit.
 *
 * The backdrop is portalled to document.body rather than rendered inline
 * as this component's child -- {children} here lives inside .app, which
 * establishes its own stacking context (see globals.css's note on the
 * Tools dropdown for the same trap). Rendered inline, the backdrop's own
 * z-index only ever wins *within* .app, so making it translucent let the
 * real nav/hero/footer underneath bleed through instead of the Starfield
 * (confirmed live -- looked like a double exposure of the actual site,
 * not a dim view of the sky). Portalled + a body class that hides .app
 * and the footer outright while the gate is up, the backdrop now sits
 * directly above #starfield/.vignette with nothing else in between.
 *
 * Previously played a light-streak "warp" burst (2D canvas, with an
 * unfinished WebGL flythrough as an even more ambitious version) between
 * click and reveal. Scrapped both -- didn't read well, and a plain fade
 * that keeps the same persistent background is a more honest match for
 * "click to look at the sky" than a flashy transition covering it up.
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
  // Computed once per mount, not on every render -- illumination shifts too
  // slowly for this to ever need recomputing within a single page visit.
  const moon = useMemo(() => getMoonPhase(), []);

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
              aria-label={`Enter Aureon — tonight's Moon is ${moon.name}, ${moon.illuminationPct}% illuminated`}
              onClick={enter}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  enter();
                }
              }}
            >
              <span className="landing-gate-eyebrow">Tonight&apos;s sky</span>
              <span className="landing-gate-phase serif">{moon.name}</span>
              <span className="mono data-accent landing-gate-illum">{moon.illuminationPct}% illuminated</span>
              <span className={`landing-gate-hint${hintVisible ? " visible" : ""}`}>Click to enter</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
