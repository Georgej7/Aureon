"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Cinematic entrance for the landing page: a single glowing point, styled
 * after Aureon's own ring-and-dot mark, sitting over the Sun's position in
 * the already-running Starfield behind it. Click/keyboard-activated -- the
 * backdrop just fades away on click, revealing the same scene that's been
 * animating underneath the whole time rather than cutting to a different
 * one or playing a separate transition over it. Shows once per browser
 * session (sessionStorage), not on every visit.
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
              aria-label="Enter"
              onClick={enter}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  enter();
                }
              }}
            />
            <span className={`landing-gate-hint${hintVisible ? " visible" : ""}`}>Click to begin</span>
          </div>,
          document.body
        )}
    </>
  );
}
