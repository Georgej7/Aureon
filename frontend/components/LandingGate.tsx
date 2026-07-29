"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Cinematic entrance for the landing page: a single glowing point in the
 * dark, click/keyboard-activated, that triggers a warp before revealing the
 * page (and the already-running Starfield behind it — the warp fades the
 * backdrop away rather than fading a new scene in, since the real scene has
 * been mounted and animating underneath the whole time).
 * Shows once per browser session (sessionStorage), not on every visit.
 *
 * The warp itself is WebGL when available (LandingWarp.tsx -- a real
 * flythrough past lit, shadowed planets toward the Sun) with the original
 * 2D canvas light-streak burst kept as the fallback for browsers without
 * WebGL2/WebGL and for prefers-reduced-motion. The WebGL bundle is only
 * fetched on click, not on page load, so it never delays the initial gate.
 */

const LandingWarp = dynamic(() => import("./LandingWarp"), { ssr: false });

function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

type Phase = "gate" | "warping" | "arrived";

const SESSION_KEY = "aureon_entered";
const WARP_MS = 1350;
const FADE_MS = 500;

export default function LandingGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("gate");
  const [hintVisible, setHintVisible] = useState(false);
  const [backdropOpacity, setBackdropOpacity] = useState(1);
  const [useCinematic, setUseCinematic] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gateBtnRef = useRef<HTMLButtonElement | null>(null);
  const reducedMotionRef = useRef(false);

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

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (phase !== "gate") return;
    gateBtnRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setHintVisible(true), 2600);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "warping" || useCinematic) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      finishWarp();
      return;
    }

    const duration = reducedMotionRef.current ? 1 : WARP_MS;
    const start = performance.now();
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const cx = w / 2;
    const cy = h / 2;
    const angles = Array.from({ length: 140 }, () => Math.random() * Math.PI * 2);
    let raf = 0;

    function draw(now: number) {
      const p = Math.min(1, (now - start) / duration);
      const reach = Math.pow(p, 2) * Math.max(w, h) * 0.9;
      const flash = Math.sin(p * Math.PI);

      ctx!.clearRect(0, 0, w, h);
      for (const a of angles) {
        const x1 = cx + Math.cos(a) * reach * 0.15;
        const y1 = cy + Math.sin(a) * reach * 0.15;
        const x2 = cx + Math.cos(a) * reach;
        const y2 = cy + Math.sin(a) * reach;
        const grad = ctx!.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, `rgba(238,212,150,${(0.5 * flash + 0.1).toFixed(2)})`);
        grad.addColorStop(1, "rgba(238,212,150,0)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1 + flash * 1.5;
        ctx!.beginPath();
        ctx!.moveTo(x1, y1);
        ctx!.lineTo(x2, y2);
        ctx!.stroke();
      }

      const flashGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
      flashGrad.addColorStop(0, `rgba(255,247,225,${(flash * 0.85).toFixed(2)})`);
      flashGrad.addColorStop(1, "rgba(255,247,225,0)");
      ctx!.fillStyle = flashGrad;
      ctx!.fillRect(0, 0, w, h);

      if (p < 1) {
        raf = requestAnimationFrame(draw);
      } else {
        finishWarp();
      }
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [phase, useCinematic]);

  function finishWarp() {
    setBackdropOpacity(0);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // fine — worst case the gate shows again next load
    }
    setTimeout(() => setPhase("arrived"), FADE_MS);
  }

  function enter() {
    if (phase !== "gate") return;
    setUseCinematic(!reducedMotionRef.current && supportsWebGL());
    setPhase("warping");
  }

  return (
    <>
      <div inert={phase !== "arrived"}>{children}</div>
      {phase !== "arrived" && (
        <div
          className="landing-gate-backdrop"
          style={{ opacity: backdropOpacity }}
          aria-hidden={phase !== "gate"}
        >
          {phase === "gate" && (
            <>
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
              <span className={`landing-gate-hint${hintVisible ? " visible" : ""}`}>
                Click to begin
              </span>
            </>
          )}
          {phase === "warping" && useCinematic && <LandingWarp onComplete={finishWarp} />}
          {phase === "warping" && !useCinematic && <canvas ref={canvasRef} className="landing-gate-canvas" />}
        </div>
      )}
    </>
  );
}
