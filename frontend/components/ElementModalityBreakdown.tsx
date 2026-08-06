"use client";

import type { NatalChart } from "@/lib/api";
import { elementForSign, modalityForSign, type Element, type Modality } from "@/lib/astrology";

const ELEMENT_COLORS: Record<Element, string> = {
  Fire: "#c1613f",
  Earth: "#6b8f5e",
  Air: "#d4c07a",
  Water: "#5c7fa6",
};

const MODALITY_COLORS: Record<Modality, string> = {
  Cardinal: "var(--gold)",
  Fixed: "var(--starlight)",
  Mutable: "var(--plum)",
};

function tally<T extends string>(signs: string[], forSign: (sign: string) => T | null, keys: T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const sign of signs) {
    const key = forSign(sign);
    if (key) counts[key]++;
  }
  return counts;
}

function Bar<T extends string>({ counts, colors, total }: { counts: Record<T, number>; colors: Record<T, string>; total: number }) {
  const keys = Object.keys(counts) as T[];
  return (
    <div>
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--bg-raised)" }}>
        {keys.map((k) =>
          counts[k] > 0 ? (
            <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: colors[k] }} title={`${k}: ${counts[k]}`} />
          ) : null
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 10 }}>
        {keys.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: colors[k], flex: "none" }} />
            {k} <span className="mono" style={{ color: "var(--text-faint)" }}>{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Standard "elemental balance" reading -- tallies the 10 classical/modern
// planets' signs (not Lilith/asteroids, same convention as
// lib/astrology.ts's dominantElement) by element and modality. Every
// competitor reference (astro-seek, astro.com) surfaces this on the natal
// report; it was entirely absent here before.
export default function ElementModalityBreakdown({ chart }: { chart: NatalChart }) {
  const signs = chart.planets.map((p) => p.sign);
  const elementCounts = tally(signs, elementForSign, ["Fire", "Earth", "Air", "Water"]);
  const modalityCounts = tally(signs, modalityForSign, ["Cardinal", "Fixed", "Mutable"]);
  const total = signs.length;

  return (
    <div className="card">
      <div className="label">Elements &amp; modalities</div>
      <p className="sub" style={{ margin: "0 0 14px" }}>Fire, Earth, Air, Water — and how much each planet leans cardinal, fixed, or mutable.</p>
      <Bar counts={elementCounts} colors={ELEMENT_COLORS} total={total} />
      <div style={{ height: 18 }} />
      <Bar counts={modalityCounts} colors={MODALITY_COLORS} total={total} />
    </div>
  );
}
