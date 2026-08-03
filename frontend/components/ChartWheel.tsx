"use client";

import type { Aspect, NatalChart, PlanetPlacement } from "@/lib/api";

const ZODIAC_SIGNS: { name: string; glyph: string }[] = [
  { name: "Aries", glyph: "♈" },
  { name: "Taurus", glyph: "♉" },
  { name: "Gemini", glyph: "♊" },
  { name: "Cancer", glyph: "♋" },
  { name: "Leo", glyph: "♌" },
  { name: "Virgo", glyph: "♍" },
  { name: "Libra", glyph: "♎" },
  { name: "Scorpio", glyph: "♏" },
  { name: "Sagittarius", glyph: "♐" },
  { name: "Capricorn", glyph: "♑" },
  { name: "Aquarius", glyph: "♒" },
  { name: "Pisces", glyph: "♓" },
];

const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  Lilith: "⚸",
  Chiron: "⚷",
  Ceres: "⚳",
  Pallas: "⚴",
  Juno: "⚵",
  Vesta: "⚶",
};

// Soft aspects (trine/sextile) read as harmonious -- gold, matching the
// brand accent. Hard aspects (square/opposition) get the rust tone already
// used for error/tension states elsewhere in the app, not a new color.
// Conjunction (neither soft nor hard, just potent) gets plum. Minor aspects
// stay faint so they don't compete visually with the major ones -- "easy to
// read" over "every aspect drawn with equal weight."
const ASPECT_STYLE: Record<string, { color: string; width: number; opacity: number }> = {
  Conjunction: { color: "var(--plum)", width: 1.4, opacity: 0.85 },
  Trine: { color: "var(--gold)", width: 1.2, opacity: 0.75 },
  Sextile: { color: "var(--gold)", width: 1, opacity: 0.55 },
  Square: { color: "#c96a4a", width: 1.2, opacity: 0.75 },
  Opposition: { color: "#c96a4a", width: 1.2, opacity: 0.75 },
  Semisextile: { color: "var(--text-faint)", width: 0.6, opacity: 0.35 },
  Semisquare: { color: "var(--text-faint)", width: 0.6, opacity: 0.35 },
  Sesquiquadrate: { color: "var(--text-faint)", width: 0.6, opacity: 0.35 },
  Quincunx: { color: "var(--text-faint)", width: 0.6, opacity: 0.35 },
};

const SIZE = 600;
const CENTER = SIZE / 2;
const ZODIAC_OUTER_R = 280;
const ZODIAC_INNER_R = 250;
const HOUSE_LINE_OUTER_R = 250;
const HOUSE_NUMBER_R = 232;
// Three radius bands for collision avoidance -- bumped from two now that
// Lilith/Chiron/Ceres/Pallas/Juno/Vesta bring the wheel to 16 possible
// points, where two bands started visibly overlapping in tightly-clustered
// charts.
const PLANET_RING_R = [205, 182, 159];
const ASPECT_R = 140; // comfortably inside all three planet rings (see PLANET_RING_R)
const MIN_PLANET_SEPARATION_DEG = 7;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Ascendant at the 9-o'clock (left) screen position, Midheaven at 12
 * o'clock (top) -- the universal chart-wheel convention -- with longitude
 * increasing counterclockwise on screen (derived from, and consistent
 * with, ASC-left/MC-top/IC-bottom/DESC-right; see session notes). Falls
 * back to placing 0deg Aries at the left when no ascendant is known (no
 * birth time/location), same "still show what's real" principle as the
 * rest of this app. */
function screenAngleDeg(longitude: number, ascendant: number | null): number {
  const asc = ascendant ?? 0;
  return (180 + (longitude - asc)) % 360;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Rounded to 2 decimals: full float precision (15+ significant digits) can
// stringify with a different last digit between server and client render
// passes, which Next.js flags as a hydration mismatch even though it's
// visually meaningless at this scale -- confirmed by reproducing the
// mismatch with unrounded coordinates before landing this fix.
function polarPoint(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = toRadians(angleDeg);
  return { x: round2(CENTER + radius * Math.cos(rad)), y: round2(CENTER - radius * Math.sin(rad)) };
}

type WheelPoint = { name: string; glyph: string; longitude: number; retrograde: boolean };

function assignRingBands(points: WheelPoint[], ascendant: number | null): (WheelPoint & { ring: number })[] {
  const sorted = [...points].sort((a, b) => screenAngleDeg(a.longitude, ascendant) - screenAngleDeg(b.longitude, ascendant));
  const placed: (WheelPoint & { ring: number })[] = [];
  for (const point of sorted) {
    const angle = screenAngleDeg(point.longitude, ascendant);
    const collidesInRing = (ring: number) =>
      placed.some((p) => {
        if (p.ring !== ring) return false;
        const diff = Math.abs(((screenAngleDeg(p.longitude, ascendant) - angle + 540) % 360) - 180);
        return diff < MIN_PLANET_SEPARATION_DEG;
      });
    const ring = !collidesInRing(0) ? 0 : !collidesInRing(1) ? 1 : 2;
    placed.push({ ...point, ring });
  }
  return placed;
}

export default function ChartWheel({ chart }: { chart: NatalChart }) {
  const ascendant = chart.ascendant;

  const points: WheelPoint[] = [
    ...chart.planets.map((p: PlanetPlacement) => ({
      name: p.name,
      glyph: PLANET_GLYPHS[p.name] ?? p.name[0],
      longitude: p.longitude,
      retrograde: p.retrograde,
    })),
    { name: "Lilith", glyph: PLANET_GLYPHS.Lilith, longitude: chart.lilith.longitude, retrograde: chart.lilith.retrograde },
    { name: "Chiron", glyph: PLANET_GLYPHS.Chiron, longitude: chart.chiron.longitude, retrograde: chart.chiron.retrograde },
    { name: "Ceres", glyph: PLANET_GLYPHS.Ceres, longitude: chart.ceres.longitude, retrograde: chart.ceres.retrograde },
    { name: "Pallas", glyph: PLANET_GLYPHS.Pallas, longitude: chart.pallas.longitude, retrograde: chart.pallas.retrograde },
    { name: "Juno", glyph: PLANET_GLYPHS.Juno, longitude: chart.juno.longitude, retrograde: chart.juno.retrograde },
    { name: "Vesta", glyph: PLANET_GLYPHS.Vesta, longitude: chart.vesta.longitude, retrograde: chart.vesta.retrograde },
  ];
  const placedPoints = assignRingBands(points, ascendant);
  const pointByName = new Map(placedPoints.map((p) => [p.name, p]));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", height: "auto", maxWidth: 560 }}>
      <circle cx={CENTER} cy={CENTER} r={ZODIAC_OUTER_R} fill="none" stroke="var(--line)" strokeWidth={1} />
      <circle cx={CENTER} cy={CENTER} r={ZODIAC_INNER_R} fill="none" stroke="var(--line)" strokeWidth={1} />
      <circle cx={CENTER} cy={CENTER} r={ASPECT_R} fill="none" stroke="var(--line)" strokeWidth={1} />

      {ZODIAC_SIGNS.map((sign, i) => {
        const boundaryAngle = screenAngleDeg(i * 30, ascendant);
        const midAngle = screenAngleDeg(i * 30 + 15, ascendant);
        const boundaryOuter = polarPoint(ZODIAC_OUTER_R, boundaryAngle);
        const boundaryInner = polarPoint(ZODIAC_INNER_R, boundaryAngle);
        const glyphPos = polarPoint((ZODIAC_OUTER_R + ZODIAC_INNER_R) / 2, midAngle);
        return (
          <g key={sign.name}>
            <line
              x1={boundaryInner.x}
              y1={boundaryInner.y}
              x2={boundaryOuter.x}
              y2={boundaryOuter.y}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={glyphPos.x}
              y={glyphPos.y}
              fill="var(--gold-soft)"
              fontSize={16}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {sign.glyph}
            </text>
          </g>
        );
      })}

      {chart.houses &&
        chart.houses.map((house) => {
          const angle = screenAngleDeg(house.longitude, ascendant);
          const outer = polarPoint(HOUSE_LINE_OUTER_R, angle);
          const isAngular = [1, 4, 7, 10].includes(house.house);
          const numberPos = polarPoint(HOUSE_NUMBER_R, screenAngleDeg(house.longitude + 10, ascendant));
          return (
            <g key={house.house}>
              <line
                x1={CENTER}
                y1={CENTER}
                x2={outer.x}
                y2={outer.y}
                stroke={isAngular ? "var(--gold-soft)" : "var(--line)"}
                strokeWidth={isAngular ? 1.4 : 0.8}
              />
              <text x={numberPos.x} y={numberPos.y} fill="var(--text-faint)" fontSize={11} textAnchor="middle" dominantBaseline="central">
                {house.house}
              </text>
            </g>
          );
        })}

      {chart.aspects.map((aspect: Aspect, i: number) => {
        const a = pointByName.get(aspect.planet_a);
        const b = pointByName.get(aspect.planet_b);
        if (!a || !b) return null;
        const style = ASPECT_STYLE[aspect.aspect_type];
        if (!style) return null;
        const pointA = polarPoint(ASPECT_R, screenAngleDeg(a.longitude, ascendant));
        const pointB = polarPoint(ASPECT_R, screenAngleDeg(b.longitude, ascendant));
        return (
          <line
            key={i}
            x1={pointA.x}
            y1={pointA.y}
            x2={pointB.x}
            y2={pointB.y}
            stroke={style.color}
            strokeWidth={style.width}
            opacity={style.opacity}
          />
        );
      })}

      {placedPoints.map((point) => {
        const angle = screenAngleDeg(point.longitude, ascendant);
        const pos = polarPoint(PLANET_RING_R[point.ring], angle);
        return (
          <g key={point.name}>
            <circle cx={pos.x} cy={pos.y} r={11} fill="var(--bg-card)" stroke="var(--line)" strokeWidth={1} />
            <text x={pos.x} y={pos.y} fill="var(--text)" fontSize={13} textAnchor="middle" dominantBaseline="central">
              {point.glyph}
            </text>
            {point.retrograde && (
              <text x={pos.x + 10} y={pos.y - 8} fill="#c96a4a" fontSize={8} textAnchor="middle">
                R
              </text>
            )}
          </g>
        );
      })}

      {ascendant !== null && (
        <text
          x={polarPoint(ZODIAC_OUTER_R + 14, screenAngleDeg(ascendant, ascendant)).x}
          y={polarPoint(ZODIAC_OUTER_R + 14, screenAngleDeg(ascendant, ascendant)).y}
          fill="var(--gold)"
          fontSize={12}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
        >
          ASC
        </text>
      )}
      {chart.midheaven !== null && (
        <text
          x={polarPoint(ZODIAC_OUTER_R + 14, screenAngleDeg(chart.midheaven, ascendant)).x}
          y={polarPoint(ZODIAC_OUTER_R + 14, screenAngleDeg(chart.midheaven, ascendant)).y}
          fill="var(--gold)"
          fontSize={12}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="central"
        >
          MC
        </text>
      )}
    </svg>
  );
}
