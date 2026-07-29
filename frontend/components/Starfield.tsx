"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient cosmos background: layered nebula glow, parallax starfield, occasional
 * comets, and a fully animated 8-planet solar system (real planet order, zodiac
 * ring, asteroid belt, live aspect-angle lines, a Mercury retrograde loop).
 * Ported near-verbatim from the static prototype's script.js so the visual design
 * stays the reference — only the DOM/event plumbing changed to fit React lifecycle.
 */

// Real-world scale is deliberately not used here -- true diameter/distance
// ratios (Jupiter is ~28x Mercury's width; Neptune orbits ~30x farther out
// than Earth) would either shrink the inner planets to invisible dots or
// push the outer ones off-screen. Proportions stay stylized for legibility;
// only the facts shown on click are the real numbers. Astro copy trimmed
// from backend/knowledge_base/western_astrology/planets.json's definitions.
const PLANET_INFO: Record<string, { real: string; astro: string }> = {
  Mercury: {
    real: "4,879 km diameter · 0.39 AU from the Sun · 88-day orbit",
    astro: "Communication, reasoning, and how you process information.",
  },
  Venus: {
    real: "12,104 km diameter · 0.72 AU from the Sun · 225-day orbit",
    astro: "Attraction, values, and what you find beautiful.",
  },
  Earth: {
    real: "12,742 km diameter · 1.00 AU from the Sun · 365-day orbit",
    astro: "Home — the only known planet with life.",
  },
  Mars: {
    real: "6,779 km diameter · 1.52 AU from the Sun · 687-day orbit",
    astro: "Drive, assertion, and how you pursue what you want.",
  },
  Jupiter: {
    real: "139,820 km diameter · 5.20 AU from the Sun · ~12-year orbit",
    astro: "Growth, meaning, and expansion.",
  },
  Saturn: {
    real: "116,460 km diameter · 9.58 AU from the Sun · ~29-year orbit",
    astro: "Structure, responsibility, and earned mastery.",
  },
  Uranus: {
    real: "50,724 km diameter · 19.2 AU from the Sun · ~84-year orbit",
    astro: "Sudden change and breaking from convention.",
  },
  Neptune: {
    real: "49,244 km diameter · 30.1 AU from the Sun · ~165-year orbit",
    astro: "Imagination, spirituality, dissolving boundaries.",
  },
};

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const latestPositionsRef = useRef<{ name: string; px: number; py: number; r: number }[]>([]);

  useEffect(() => {
    selectedRef.current = selectedPlanet;
  }, [selectedPlanet]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0,
      h = 0;
    type Star = {
      x: number;
      y: number;
      r: number;
      depth: number;
      baseAlpha: number;
      phase: number;
      speed: number;
      drift: number;
      color: string;
    };
    type Nebula = { x: number; y: number; r: number; color: string; depth: number };
    type MilkyWayStar = { x: number; y: number; r: number; baseAlpha: number; phase: number; speed: number };
    let stars: Star[] = [];
    let nebulas: Nebula[] = [];
    let milkyWayStars: MilkyWayStar[] = [];
    let mx = 0,
      my = 0;

    // Real asterisms, not decorative sparkle -- fixed screen-fraction
    // positions (roughly true to each shape) so the sky reads as charted,
    // not generated. Placed clear of the solar-system HUD's centered orbit.
    const CONSTELLATIONS: { name: string; points: [number, number][]; lines: [number, number][]; highlight?: number[] }[] = [
      {
        name: "Ursa Major",
        points: [
          [0.06, 0.1],
          [0.09, 0.16],
          [0.14, 0.19],
          [0.17, 0.14],
          [0.21, 0.16],
          [0.24, 0.2],
          [0.27, 0.25],
        ],
        lines: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
          [3, 4],
          [4, 5],
          [5, 6],
        ],
      },
      {
        name: "Cassiopeia",
        points: [
          [0.66, 0.14],
          [0.72, 0.05],
          [0.79, 0.13],
          [0.85, 0.06],
          [0.92, 0.15],
        ],
        lines: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 4],
        ],
      },
      {
        name: "Orion",
        points: [
          [0.08, 0.6],
          [0.25, 0.62],
          [0.14, 0.74],
          [0.18, 0.76],
          [0.22, 0.78],
          [0.1, 0.9],
          [0.27, 0.9],
        ],
        lines: [
          [0, 2],
          [1, 4],
          [2, 3],
          [3, 4],
          [2, 5],
          [4, 6],
        ],
        // The belt (indices 2-4) is the asterism's signature -- real Orion's
        // belt stars are genuinely more prominent naked-eye than the rest.
        highlight: [2, 3, 4],
      },
    ];

    function resize() {
      if (!canvas) return;
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.round((w * h) / 4500);
      stars = Array.from({ length: count }, () => {
        const layer = Math.random();
        const tint = Math.random();
        const tintColor =
          tint < 0.7 ? "242,237,226" : tint < 0.87 ? "168,220,232" : "212,180,130";
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer < 0.6 ? Math.random() * 0.9 + 0.3 : Math.random() * 1.8 + 0.8,
          depth: layer < 0.6 ? 0.3 : 1,
          baseAlpha: Math.random() * 0.5 + 0.25,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.02 + 0.006,
          drift: Math.random() * 0.12 + 0.02,
          color: tintColor,
        };
      });
      nebulas = [
        { x: w * 0.18, y: h * 0.25, r: Math.max(w, h) * 0.35, color: "180,146,79", depth: 0.15 },
        { x: w * 0.82, y: h * 0.15, r: Math.max(w, h) * 0.28, color: "111,95,140", depth: 0.25 },
        { x: w * 0.5, y: h * 0.85, r: Math.max(w, h) * 0.32, color: "111,95,140", depth: 0.1 },
      ];

      // Extra pinpoint density inside the Milky Way band -- coordinates are
      // local to drawMilkyWayStars' own rotated/translated context, matching
      // drawMilkyWay's band dimensions. Triangular distribution on y (sum of
      // two randoms) clusters stars toward the band's centerline rather than
      // spreading evenly across its width, the way real star density falls
      // off from the galactic plane.
      const bandLength = Math.max(w, h) * 1.9;
      const bandWidth = Math.max(w, h) * 0.36;
      milkyWayStars = Array.from({ length: Math.round((w * h) / 3800) }, () => ({
        x: (Math.random() - 0.5) * bandLength,
        y: (Math.random() + Math.random() - 1) * bandWidth * 0.5,
        r: Math.random() * 0.7 + 0.25,
        baseAlpha: Math.random() * 0.35 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.006,
      }));
    }

    function handleResize() {
      resize();
    }
    function handleMouseMove(e: MouseEvent) {
      mx = e.clientX / w - 0.5;
      my = e.clientY / h - 0.5;
      document.body.style.cursor = hitTestPlanet(e.clientX, e.clientY) ? "pointer" : "";
    }

    // #starfield sits behind .app in z-order, but .app's own layout boxes
    // (section/div wrappers) are large and transparent -- they still win
    // hit-testing for any point inside their box even where nothing is
    // visually drawn, so the canvas rarely actually receives the click.
    // Hit-testing against clientX/Y directly on a window-level listener
    // works regardless of which element the browser resolved as the target.
    function hitTestPlanet(clientX: number, clientY: number): string | null {
      let hit: string | null = null;
      let hitDist = Infinity;
      for (const target of latestPositionsRef.current) {
        const d = Math.hypot(target.px - clientX, target.py - clientY);
        const threshold = Math.max(target.r * 1.6, 16);
        if (d < threshold && d < hitDist) {
          hit = target.name;
          hitDist = d;
        }
      }
      return hit;
    }
    function handleWindowClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest && target.closest("a,button,input,textarea,select,[role='button']")) return;
      const hit = hitTestPlanet(e.clientX, e.clientY);
      setSelectedPlanet((prev) => (hit ? (prev === hit ? null : hit) : null));
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleWindowClick);
    resize();

    let t = 0;
    let comets: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    let nextCometAt = 90 + Math.random() * 180;
    const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    let rafId = 0;
    // Selecting a planet freezes it in place rather than following its
    // orbit -- easier to read the info panel against a moving target
    // otherwise. Cleared the moment selection moves elsewhere.
    const frozenAngles = new Map<string, number>();

    function drawComets() {
      if (!ctx) return;
      if (t > nextCometAt) {
        comets.push({
          x: Math.random() * w * 0.5,
          y: Math.random() * h * 0.3,
          vx: 6 + Math.random() * 4,
          vy: 3 + Math.random() * 2,
          life: 0,
          maxLife: 40,
        });
        nextCometAt = t + 240 + Math.random() * 360;
      }
      comets = comets.filter((c) => c.life < c.maxLife);
      for (const c of comets) {
        c.life++;
        const cx2 = c.x + c.vx * c.life,
          cy2 = c.y + c.vy * c.life;
        const fade = 1 - c.life / c.maxLife;
        const grad = ctx.createLinearGradient(cx2, cy2, cx2 - c.vx * 10, cy2 - c.vy * 10);
        grad.addColorStop(0, "rgba(255,250,235," + (0.9 * fade).toFixed(2) + ")");
        grad.addColorStop(1, "rgba(255,250,235,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(cx2 - c.vx * 10, cy2 - c.vy * 10);
        ctx.stroke();
      }
    }

    function drawOrbitSystem() {
      if (!ctx) return;
      const cx = w * 0.5 + mx * 16,
        cy = h * 0.46 + my * 16;
      const scale = Math.min(w, h) * 1.55;
      const rot = -0.32 + Math.sin(t * 0.0005) * 0.025;

      const planets = [
        { name: "Mercury", a: scale * 0.075, b: scale * 0.025, speed: 0.00105, size: 0.0042, color: "168,162,152", phase: 0.4, dTilt: 0.008, retro: true, ring: false, hasMoon: false, banded: false },
        { name: "Venus", a: scale * 0.1, b: scale * 0.034, speed: 0.00078, size: 0.0068, color: "232,214,168", phase: 2.6, dTilt: -0.014, retro: false, ring: false, hasMoon: false, banded: false },
        { name: "Earth", a: scale * 0.13, b: scale * 0.044, speed: 0.00062, size: 0.0072, color: "94,144,192", phase: 4.4, dTilt: 0.011, retro: false, ring: false, hasMoon: true, banded: false },
        { name: "Mars", a: scale * 0.165, b: scale * 0.056, speed: 0.0005, size: 0.0056, color: "193,99,63", phase: 1.1, dTilt: -0.017, retro: false, ring: false, hasMoon: false, banded: false },
        { name: "Jupiter", a: scale * 0.235, b: scale * 0.08, speed: 0.00033, size: 0.0155, color: "205,172,132", phase: 3.3, dTilt: 0.02, retro: false, ring: false, hasMoon: false, banded: true },
        { name: "Saturn", a: scale * 0.3, b: scale * 0.102, speed: 0.00024, size: 0.0135, color: "222,201,153", phase: 5.2, dTilt: -0.023, retro: false, ring: true, hasMoon: false, banded: false },
        { name: "Uranus", a: scale * 0.355, b: scale * 0.121, speed: 0.00017, size: 0.0092, color: "172,222,222", phase: 0.9, dTilt: 0.026, retro: false, ring: false, hasMoon: false, banded: false },
        { name: "Neptune", a: scale * 0.41, b: scale * 0.14, speed: 0.00012, size: 0.0088, color: "78,104,205", phase: 2.2, dTilt: -0.03, retro: false, ring: false, hasMoon: false, banded: false },
      ];

      const zR = scale * 0.47;
      ctx.beginPath();
      ctx.ellipse(cx, cy, zR, zR * 0.34, rot, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(180,146,79,0.15)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.font = scale * 0.016 + "px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 12; i++) {
        const zAng = (i / 12) * Math.PI * 2 + t * 0.00004;
        const zx = zR * Math.cos(zAng) * Math.cos(rot) - zR * 0.34 * Math.sin(zAng) * Math.sin(rot);
        const zy = zR * Math.cos(zAng) * Math.sin(rot) + zR * 0.34 * Math.sin(zAng) * Math.cos(rot);
        ctx.fillStyle = "rgba(180,146,79,0.4)";
        // Deliberately no U+FE0E text-presentation selector here — the
        // colorful emoji rendering on iOS/Safari is preferred over plain
        // gold text for these symbols (confirmed after seeing both).
        ctx.fillText(ZODIAC[i], cx + zx, cy + zy);
      }

      const sunR = scale * 0.03;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 0.00012;
        const rayLen = sunR * (5 + Math.sin(t * 0.001 + i) * 1.2);
        const rg = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * rayLen, cy + Math.sin(a) * rayLen);
        rg.addColorStop(0, "rgba(238,212,150,0.06)");
        rg.addColorStop(1, "rgba(238,212,150,0)");
        ctx.strokeStyle = rg;
        ctx.lineWidth = sunR * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * rayLen, cy + Math.sin(a) * rayLen);
        ctx.stroke();
      }

      for (const p of planets) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, p.a, p.b, rot + p.dTilt, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(180,146,79,0.2)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      const beltR = (planets[3].a + planets[4].a) / 2;
      for (let i = 0; i < 70; i++) {
        const bAng = (i / 70) * Math.PI * 2 + t * 0.00018;
        const wobble = (i % 7) * scale * 0.0012;
        const bx = (beltR + wobble) * Math.cos(bAng) * Math.cos(rot) - (beltR + wobble) * 0.34 * Math.sin(bAng) * Math.sin(rot);
        const by = (beltR + wobble) * Math.cos(bAng) * Math.sin(rot) + (beltR + wobble) * 0.34 * Math.sin(bAng) * Math.cos(rot);
        ctx.beginPath();
        ctx.arc(cx + bx, cy + by, 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(180,170,155,0.35)";
        ctx.fill();
      }

      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 5);
      sunGrad.addColorStop(0, "rgba(238,212,150,0.32)");
      sunGrad.addColorStop(0.35, "rgba(180,146,79,0.18)");
      sunGrad.addColorStop(1, "rgba(180,146,79,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, sunR * 5, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();
      const sunBody = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR);
      sunBody.addColorStop(0, "rgba(235,215,180,0.65)");
      sunBody.addColorStop(0.65, "rgba(222,196,150,0.65)");
      sunBody.addColorStop(1, "rgba(195,155,100,0.6)");
      ctx.beginPath();
      ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
      ctx.fillStyle = sunBody;
      ctx.fill();

      const positions = [];
      for (const p of planets) {
        const planetRot = rot + p.dTilt;
        let ang: number;
        if (selectedRef.current === p.name) {
          if (!frozenAngles.has(p.name)) frozenAngles.set(p.name, t * p.speed + p.phase);
          ang = frozenAngles.get(p.name)!;
        } else {
          frozenAngles.delete(p.name);
          ang = t * p.speed + p.phase;
        }

        let retroGlow = 0;
        if (p.retro && selectedRef.current !== p.name) {
          const cyc = 2400,
            ph = (t % cyc) / cyc;
          if (ph > 0.4 && ph < 0.6) {
            const local = (ph - 0.4) / 0.2;
            ang -= Math.sin(local * Math.PI) * 0.4;
            retroGlow = Math.sin(local * Math.PI);
          }
        }
        const ex = p.a * Math.cos(ang),
          ey = p.b * Math.sin(ang);
        const px = cx + ex * Math.cos(planetRot) - ey * Math.sin(planetRot);
        const py = cy + ex * Math.sin(planetRot) + ey * Math.cos(planetRot);
        positions.push({ p, px, py, ang, planetRot, retroGlow });
      }

      const ASPECTS = [0, 60, 90, 120, 180];
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const diffDeg = Math.abs((((positions[i].ang - positions[j].ang) * 180) / Math.PI) % 360);
          const d = Math.min(diffDeg, 360 - diffDeg);
          const closest = ASPECTS.reduce((best, a) => (Math.abs(d - a) < Math.abs(best - d) ? a : best), 180);
          const delta = Math.abs(d - closest);
          if (delta < 3) {
            const alpha = (1 - delta / 3) * 0.22;
            ctx.beginPath();
            ctx.moveTo(positions[i].px, positions[i].py);
            ctx.lineTo(positions[j].px, positions[j].py);
            ctx.strokeStyle = "rgba(180,146,79," + alpha.toFixed(2) + ")";
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      const hitTargets: { name: string; px: number; py: number; r: number }[] = [];
      for (const { p, px, py, ang, planetRot, retroGlow } of positions) {
        const isSelected = selectedRef.current === p.name;
        const behind = !isSelected && Math.sin(ang) > 0.15;
        const r = scale * p.size * (isSelected ? 2.2 : 1);
        hitTargets.push({ name: p.name, px, py, r: Math.max(r, 10) });

        ctx.globalAlpha = behind ? 0.5 : 1;

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + p.color + ",0.55)";
        ctx.fill();

        const dx = cx - px,
          dy = cy - py;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist,
          ny = dy / dist;
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.clip();
        const lit = ctx.createRadialGradient(px + nx * r * 0.5, py + ny * r * 0.5, 0, px + nx * r * 0.5, py + ny * r * 0.5, r * 1.4);
        lit.addColorStop(0, "rgba(" + p.color + ",1)");
        lit.addColorStop(0.6, "rgba(" + p.color + ",0.5)");
        lit.addColorStop(1, "rgba(" + p.color + ",0)");
        ctx.fillStyle = lit;
        ctx.fillRect(px - r * 1.5, py - r * 1.5, r * 3, r * 3);
        const shadow = ctx.createRadialGradient(px - nx * r * 0.6, py - ny * r * 0.6, 0, px - nx * r * 0.6, py - ny * r * 0.6, r * 1.3);
        shadow.addColorStop(0, "rgba(10,8,6,0.45)");
        shadow.addColorStop(1, "rgba(10,8,6,0)");
        ctx.fillStyle = shadow;
        ctx.fillRect(px - r * 1.5, py - r * 1.5, r * 3, r * 3);

        // Jupiter's banding + Great Red Spot -- the one planet where a
        // recognizable surface feature actually reads at this size.
        if (p.banded) {
          // Still inside the clip region established above -- no need to
          // re-clip, the circle boundary is already active.
          ctx.strokeStyle = "rgba(150,110,80,0.35)";
          ctx.lineWidth = r * 0.16;
          [-0.55, -0.1, 0.35].forEach((off) => {
            ctx.beginPath();
            ctx.moveTo(px - r * 1.3, py + off * r);
            ctx.lineTo(px + r * 1.3, py + off * r * 0.9);
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.ellipse(px + r * 0.35, py + r * 0.2, r * 0.22, r * 0.13, 0.3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(196,110,80,0.55)";
          ctx.fill();
        }
        ctx.restore();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, r * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(168,220,232,0.55)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        if (p.ring) {
          ctx.beginPath();
          ctx.ellipse(px, py, r * 2.1, r * 0.62, planetRot + 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(230,205,150,0.55)";
          ctx.lineWidth = r * 0.28;
          ctx.stroke();
        }

        const pg = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
        pg.addColorStop(0, "rgba(" + p.color + ",0.22)");
        pg.addColorStop(1, "rgba(" + p.color + ",0)");
        ctx.beginPath();
        ctx.arc(px, py, r * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();

        if (retroGlow > 0) {
          const rg2 = ctx.createRadialGradient(px, py, 0, px, py, r * 3.2);
          rg2.addColorStop(0, "rgba(214,150,60," + (retroGlow * 0.5).toFixed(2) + ")");
          rg2.addColorStop(1, "rgba(214,150,60,0)");
          ctx.beginPath();
          ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = rg2;
          ctx.fill();
        }

        if (p.hasMoon) {
          const moonAng = t * 0.0032;
          const moonOrbit = r * 2.8;
          const mx2 = px + moonOrbit * Math.cos(moonAng) * Math.cos(planetRot) - moonOrbit * 0.4 * Math.sin(moonAng) * Math.sin(planetRot);
          const my2 = py + moonOrbit * Math.cos(moonAng) * Math.sin(planetRot) + moonOrbit * 0.4 * Math.sin(moonAng) * Math.cos(planetRot);
          ctx.beginPath();
          ctx.ellipse(px, py, moonOrbit, moonOrbit * 0.4, planetRot, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(180,146,79,0.16)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(mx2, my2, r * 0.34, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(228,225,217,0.95)";
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      latestPositionsRef.current = hitTargets;
    }

    // The diffuse diagonal band real dark skies actually show -- denser,
    // paler starlight with a cooler dust-lane core, not evenly scattered
    // dots. Drawn once as a soft gradient rather than repositioning the
    // star field itself; cheap, and reads instantly as "galaxy" rather
    // than more sparkle.
    function drawMilkyWay() {
      if (!ctx) return;
      const cx = w * 0.5 + mx * 12;
      const cy = h * 0.42 + my * 12;
      const bandLength = Math.max(w, h) * 1.9;
      const bandWidth = Math.max(w, h) * 0.36;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.45);
      const grad = ctx.createLinearGradient(0, -bandWidth / 2, 0, bandWidth / 2);
      grad.addColorStop(0, "rgba(226,214,196,0)");
      grad.addColorStop(0.28, "rgba(226,214,196,0.15)");
      grad.addColorStop(0.5, "rgba(205,196,222,0.26)");
      grad.addColorStop(0.72, "rgba(226,214,196,0.15)");
      grad.addColorStop(1, "rgba(226,214,196,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-bandLength / 2, -bandWidth / 2, bandLength, bandWidth);
      ctx.restore();
    }

    function drawMilkyWayStars() {
      if (!ctx) return;
      const cx = w * 0.5 + mx * 12;
      const cy = h * 0.42 + my * 12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.45);
      for (const s of milkyWayStars) {
        const twinkle = s.baseAlpha + Math.sin(t * s.speed + s.phase) * 0.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(232,224,210," + Math.max(0, twinkle).toFixed(2) + ")";
        ctx.fill();
      }
      ctx.restore();
    }

    function drawConstellations() {
      if (!ctx) return;
      for (const c of CONSTELLATIONS) {
        const pts = c.points.map(([nx, ny]) => [nx * w + mx * 10, ny * h + my * 10]);
        ctx.beginPath();
        for (const [a, b] of c.lines) {
          ctx.moveTo(pts[a][0], pts[a][1]);
          ctx.lineTo(pts[b][0], pts[b][1]);
        }
        ctx.strokeStyle = "rgba(180,146,79,0.28)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
        pts.forEach(([px, py], i) => {
          const isHighlight = c.highlight?.includes(i) ?? false;
          const twinkle = (isHighlight ? 0.95 : 0.75) + Math.sin(t * 0.01 + i) * 0.15;
          const glowR = isHighlight ? 6 : 4;
          const starR = isHighlight ? 2.4 : 1.6;
          ctx.beginPath();
          ctx.arc(px, py, glowR, 0, Math.PI * 2);
          ctx.fillStyle = isHighlight ? "rgba(232,224,210,0.18)" : "rgba(180,146,79,0.12)";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, starR, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(232,224,210," + Math.min(1, twinkle).toFixed(2) + ")";
          ctx.fill();
        });
      }
    }

    function frame() {
      if (!ctx) return;
      t += 1;
      ctx.clearRect(0, 0, w, h);

      drawMilkyWay();
      drawMilkyWayStars();
      drawConstellations();

      for (const n of nebulas) {
        const nx = n.x + mx * 30 * n.depth;
        const ny = n.y + my * 30 * n.depth;
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r);
        grad.addColorStop(0, "rgba(" + n.color + ",0.10)");
        grad.addColorStop(1, "rgba(" + n.color + ",0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const s of stars) {
        s.y += s.drift * 0.05;
        if (s.y > h) s.y = 0;
        const twinkle = s.baseAlpha + Math.sin(t * s.speed + s.phase) * 0.25;
        const px = s.x + mx * 22 * s.depth;
        const py = s.y + my * 22 * s.depth;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.color + "," + Math.max(0, twinkle).toFixed(2) + ")";
        ctx.fill();
        if (s.depth === 1 && twinkle > 0.55) {
          ctx.beginPath();
          ctx.arc(px, py, s.r * 2.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(180,146,79," + (twinkle * 0.12).toFixed(2) + ")";
          ctx.fill();
        }
      }

      drawOrbitSystem();
      drawComets();

      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleWindowClick);
      document.body.style.cursor = "";
    };
  }, []);

  const info = selectedPlanet ? PLANET_INFO[selectedPlanet] : null;

  return (
    <>
      <canvas id="starfield" ref={canvasRef} />
      {info && selectedPlanet && (
        <div className="planet-info-panel" onClick={(e) => e.stopPropagation()}>
          <button
            className="planet-info-close"
            onClick={() => setSelectedPlanet(null)}
            aria-label="Close"
          >
            ×
          </button>
          <p className="planet-info-label">Planet</p>
          <h3>{selectedPlanet}</h3>
          <p className="mono data-accent planet-info-real">{info.real}</p>
          <p className="planet-info-astro">{info.astro}</p>
        </div>
      )}
    </>
  );
}
