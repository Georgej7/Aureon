"use client";

import { useEffect, useState } from "react";
import type { EphemerisDayResponse } from "@/lib/api";
import { postEphemerisDay } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const PLANET_ORDER = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

export default function EphemerisPage() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<EphemerisDayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setError("Sign in to view the ephemeris.");
            setLoading(false);
          }
          return;
        }
        const result = await postEphemerisDay(date, session.access_token);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError("Couldn't load the ephemeris — is the backend running? Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const orderedPlanets = data
    ? [...data.planets].sort((a, b) => PLANET_ORDER.indexOf(a.name) - PLANET_ORDER.indexOf(b.name))
    : [];

  return (
    <section className="screen active" id="ephemeris">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Reference table · 1800–2100
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Ephemeris tables</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Planetary positions for any date, snapshotted at 12:00 UT (noon Universal Time) — the
        same reference convention used in published ephemerides.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => setDate((d) => addDays(d, -1))}>
            ← Previous day
          </button>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="ephemeris-date">Date</label>
            <input
              id="ephemeris-date"
              type="date"
              min="1800-01-01"
              max="2100-12-31"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setDate((d) => addDays(d, 1))}>
            Next day →
          </button>
          <button className="btn" onClick={() => setDate(todayIso())}>
            Today
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {!loading && data && (
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
                  Planet
                </th>
                <th style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
                  Sign
                </th>
                <th style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
                  Degree
                </th>
                <th style={{ padding: "8px 10px", fontSize: 12, color: "var(--text-faint)", fontWeight: 500 }}>
                  Motion
                </th>
              </tr>
            </thead>
            <tbody>
              {orderedPlanets.map((p) => (
                <tr key={p.name} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 10px", fontSize: 14 }}>{p.name}</td>
                  <td style={{ padding: "8px 10px", fontSize: 14, color: "var(--text-dim)" }}>{p.sign}</td>
                  <td style={{ padding: "8px 10px", fontSize: 14, color: "var(--text-dim)" }}>
                    {p.sign_degree.toFixed(2)}°
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 14, color: p.retrograde ? "#c96a4a" : "var(--text-dim)" }}>
                    {p.retrograde ? "Retrograde" : "Direct"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
