"use client";

import type { NatalChart } from "@/lib/api";

const GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  Lilith: "⚸", Chiron: "⚷", Ceres: "⚳", Pallas: "⚴", Juno: "⚵", Vesta: "⚶",
};

const SIGN_GLYPHS: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍",
  Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

// Astro-seek/astro.com both lead with a dense, scannable position table
// before any expandable prose -- practitioners want to read a whole chart's
// placements in one glance, not click through ten cards. This sits above
// NatalPlacementList as the "scan" view; the cards remain the "read" view.
export default function PositionTable({ chart, includeHouses = true }: { chart: NatalChart; includeHouses?: boolean }) {
  const points = [
    ...chart.planets,
    chart.lilith, chart.chiron, chart.ceres, chart.pallas, chart.juno, chart.vesta,
  ];

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div className="label">Positions</div>
      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text-faint)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            <th style={{ padding: "6px 10px 6px 0", fontWeight: 500 }}>Point</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Sign</th>
            <th style={{ padding: "6px 10px", fontWeight: 500 }}>Degree</th>
            {includeHouses && <th style={{ padding: "6px 10px", fontWeight: 500 }}>House</th>}
            <th style={{ padding: "6px 0", fontWeight: 500 }}>℞</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.name} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={{ padding: "7px 10px 7px 0", color: "var(--text)" }}>
                {GLYPHS[p.name] ?? "•"} {p.name}
              </td>
              <td style={{ padding: "7px 10px", color: "var(--text-dim)" }}>
                {SIGN_GLYPHS[p.sign] ?? ""} {p.sign}
              </td>
              <td style={{ padding: "7px 10px", color: "var(--data-accent, var(--starlight))" }}>{p.sign_degree.toFixed(1)}°</td>
              {includeHouses && (
                <td style={{ padding: "7px 10px", color: "var(--text-dim)" }}>{p.house ?? "—"}</td>
              )}
              <td style={{ padding: "7px 0", color: p.retrograde ? "var(--gold)" : "var(--text-faint)" }}>{p.retrograde ? "℞" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {chart.houses && chart.houses.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 20 }}>House cusps</div>
          <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              {chart.houses.map((h) => (
                <tr key={h.house} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "7px 10px 7px 0", color: "var(--text)" }}>House {h.house}</td>
                  <td style={{ padding: "7px 10px", color: "var(--text-dim)" }}>
                    {SIGN_GLYPHS[h.sign] ?? ""} {h.sign}
                  </td>
                  <td style={{ padding: "7px 0", color: "var(--data-accent, var(--starlight))" }}>{h.sign_degree.toFixed(1)}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
