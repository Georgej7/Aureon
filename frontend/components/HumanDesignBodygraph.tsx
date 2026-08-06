"use client";

import type { HumanDesignChart } from "@/lib/api";

// Standard bodygraph layout -- the same relative positions (Head/Ajna/
// Throat/G stacked centrally, Heart right of G, Spleen/SolarPlexus flanking
// at Sacral height, Sacral below G, Root at the base) used consistently
// across Human Design resources. Channel lines connect center-to-center
// rather than exact gate attachment points on each center's boundary --
// that finer detail would need sourcing precise x/y positions for all 64
// gates, a much larger data-accuracy task than this warrants; center-to-
// center still correctly conveys which channels are actually active.
const CENTERS: Record<string, { x: number; y: number; shape: "triangle-up" | "triangle-down" | "triangle-left" | "triangle-right" | "square" | "diamond" }> = {
  Head: { x: 0.5, y: 0.05, shape: "triangle-up" },
  Ajna: { x: 0.5, y: 0.22, shape: "triangle-down" },
  Throat: { x: 0.5, y: 0.4, shape: "square" },
  G: { x: 0.5, y: 0.58, shape: "diamond" },
  Heart: { x: 0.76, y: 0.53, shape: "triangle-left" },
  Spleen: { x: 0.16, y: 0.68, shape: "triangle-right" },
  SolarPlexus: { x: 0.84, y: 0.68, shape: "triangle-left" },
  Sacral: { x: 0.5, y: 0.76, shape: "square" },
  Root: { x: 0.5, y: 0.89, shape: "square" },
};

const SIZE = 400;
const SHAPE_R = 22;

function shapePath(cx: number, cy: number, shape: string): string {
  const r = SHAPE_R;
  switch (shape) {
    case "triangle-up":
      return `M ${cx} ${cy - r} L ${cx + r} ${cy + r * 0.75} L ${cx - r} ${cy + r * 0.75} Z`;
    case "triangle-down":
      return `M ${cx} ${cy + r} L ${cx + r} ${cy - r * 0.75} L ${cx - r} ${cy - r * 0.75} Z`;
    case "triangle-left":
      return `M ${cx - r} ${cy} L ${cx + r * 0.75} ${cy - r} L ${cx + r * 0.75} ${cy + r} Z`;
    case "triangle-right":
      return `M ${cx + r} ${cy} L ${cx - r * 0.75} ${cy - r} L ${cx - r * 0.75} ${cy + r} Z`;
    case "diamond":
      return `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`;
    default: // square
      return `M ${cx - r * 0.8} ${cy - r * 0.8} L ${cx + r * 0.8} ${cy - r * 0.8} L ${cx + r * 0.8} ${cy + r * 0.8} L ${cx - r * 0.8} ${cy + r * 0.8} Z`;
  }
}

// Only used to draw channel lines between the two centers a given gate
// pair's centers belong to -- doesn't need to be exhaustive/exported,
// just enough to look up which of the 9 centers a gate lives in.
const GATE_TO_CENTER: Record<number, string> = {
  61: "Head", 63: "Head", 64: "Head",
  4: "Ajna", 11: "Ajna", 17: "Ajna", 24: "Ajna", 43: "Ajna", 47: "Ajna",
  8: "Throat", 12: "Throat", 16: "Throat", 20: "Throat", 23: "Throat", 31: "Throat", 33: "Throat", 35: "Throat", 45: "Throat", 56: "Throat", 62: "Throat",
  1: "G", 2: "G", 7: "G", 10: "G", 13: "G", 15: "G", 25: "G", 46: "G",
  21: "Heart", 26: "Heart", 40: "Heart", 51: "Heart",
  18: "Spleen", 28: "Spleen", 32: "Spleen", 44: "Spleen", 48: "Spleen", 50: "Spleen", 57: "Spleen",
  3: "Sacral", 5: "Sacral", 9: "Sacral", 14: "Sacral", 27: "Sacral", 29: "Sacral", 34: "Sacral", 42: "Sacral", 59: "Sacral",
  6: "SolarPlexus", 22: "SolarPlexus", 30: "SolarPlexus", 36: "SolarPlexus", 37: "SolarPlexus", 49: "SolarPlexus", 55: "SolarPlexus",
  19: "Root", 38: "Root", 39: "Root", 41: "Root", 52: "Root", 53: "Root", 54: "Root", 58: "Root", 60: "Root",
};

export default function HumanDesignBodygraph({ chart }: { chart: HumanDesignChart }) {
  const definedSet = new Set(chart.defined_centers);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", height: "auto", maxWidth: 420 }}>
      {chart.active_channels.map((ch, i) => {
        const centerA = CENTERS[GATE_TO_CENTER[ch.gates[0]]];
        const centerB = CENTERS[GATE_TO_CENTER[ch.gates[1]]];
        if (!centerA || !centerB) return null;
        return (
          <line
            key={i}
            x1={centerA.x * SIZE}
            y1={centerA.y * SIZE}
            x2={centerB.x * SIZE}
            y2={centerB.y * SIZE}
            stroke="var(--gold)"
            strokeWidth={3}
            opacity={0.85}
          />
        );
      })}
      {Object.entries(CENTERS).map(([name, { x, y, shape }]) => {
        const defined = definedSet.has(name);
        // Label sits below the shape rather than inside it -- "Solar
        // Plexus"/"Sacral" etc. don't fit legibly inside a ~50px shape at
        // any reasonable font size, and every real bodygraph reference
        // labels centers this way (beside/below), not lettered on top.
        const labelY = y * SIZE + SHAPE_R + 12;
        return (
          <g key={name}>
            <path
              d={shapePath(x * SIZE, y * SIZE, shape)}
              fill={defined ? "var(--gold)" : "var(--bg-card)"}
              stroke={defined ? "var(--gold)" : "var(--line)"}
              strokeWidth={1.5}
            />
            <text
              x={x * SIZE}
              y={labelY}
              fontSize={10}
              textAnchor="middle"
              fill={defined ? "var(--gold)" : "var(--text-faint)"}
              fontWeight={defined ? 600 : 400}
            >
              {name === "SolarPlexus" ? "Solar Plexus" : name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
