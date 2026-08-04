"use client";

import { useState } from "react";
import type { AspectSearchHit } from "@/lib/api";
import { postAspectSearch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const PLANETS = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

const ASPECT_TYPES = [
  "Conjunction", "Sextile", "Square", "Trine", "Opposition",
  "Semisextile", "Semisquare", "Sesquiquadrate", "Quincunx",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AspectSearchPage() {
  const [planetA, setPlanetA] = useState("Jupiter");
  const [planetB, setPlanetB] = useState("Saturn");
  const [aspectType, setAspectType] = useState("Conjunction");
  const [startDate, setStartDate] = useState(todayIso());
  const [days, setDays] = useState(365);
  const [hits, setHits] = useState<AspectSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const samePlanet = planetA === planetB;

  async function handleSearch() {
    if (samePlanet || searching) return;
    setSearching(true);
    setError(null);
    setHits(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Sign in to search.");
        return;
      }
      const result = await postAspectSearch(
        { planet_a: planetA, planet_b: planetB, aspect_type: aspectType, start_date: startDate, days },
        session.access_token
      );
      setHits(result.hits);
    } catch {
      setError("Couldn't run the search — is the backend running? Try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="screen active" id="aspect-search">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Reference tool
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Aspect search</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Find when two planets next form a given aspect. Sampled once per day at 12:00 UT — exact
        for slow-moving outer-planet transits; can miss or double-count fast movers like the
        Moon over long ranges.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row2">
          <div className="field">
            <label htmlFor="planet-a">Planet A</label>
            <select id="planet-a" value={planetA} onChange={(e) => setPlanetA(e.target.value)}>
              {PLANETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="planet-b">Planet B</label>
            <select id="planet-b" value={planetB} onChange={(e) => setPlanetB(e.target.value)}>
              {PLANETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="aspect-type">Aspect</label>
          <select id="aspect-type" value={aspectType} onChange={(e) => setAspectType(e.target.value)}>
            {ASPECT_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="start-date">Starting from</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="days">Search window (days)</label>
            <input
              id="days"
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
        </div>
        {samePlanet && (
          <p style={{ color: "#c96a4a", fontSize: 13, margin: "10px 0 0" }}>
            Pick two different planets.
          </p>
        )}
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
        <button
          className="btn btn-gold"
          style={{ marginTop: 14, opacity: samePlanet || searching ? 0.6 : 1 }}
          onClick={handleSearch}
          disabled={samePlanet || searching}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {hits && (
        <div className="card">
          <div className="label">
            {hits.length} {hits.length === 1 ? "hit" : "hits"} · {planetA} {aspectType} {planetB}
          </div>
          {hits.length === 0 ? (
            <p className="sub">No exact-enough hit in this window — try a longer search range.</p>
          ) : (
            <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
              {hits.map((h) => (
                <li
                  key={h.date}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{h.date}</span>
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    orb {h.orb.toFixed(2)}°{h.exact ? " · exact" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
