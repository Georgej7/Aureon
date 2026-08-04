"use client";

import { useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import type { NatalChart } from "@/lib/api";
import { postNatalChart } from "@/lib/api";
import { zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

// Birth dates only -- no birth time or coordinates. Exact birth times aren't
// reliably documented for any of these figures (unlike a living user who
// enters their own), so this deliberately omits them rather than guess --
// same "only show what's real" principle as the birth-time-unknown case
// elsewhere in the app. That also means no houses/Ascendant for anyone
// here, which is honest, not a bug. Each date verified via web search against
// Wikipedia/Britannica/Nobel Prize official biography rather than trusted
// from memory -- getting a real historical figure's birth date wrong would
// be a real factual error about a real person, not a cosmetic bug.
const FIGURES: { name: string; date: string; blurb: string; source: string }[] = [
  {
    name: "Albert Einstein",
    date: "1879-03-14",
    blurb: "Theoretical physicist, developed the theory of relativity.",
    source: "en.wikipedia.org/wiki/Albert_Einstein",
  },
  {
    name: "Marie Curie",
    date: "1867-11-07",
    blurb: "Physicist and chemist, first person to win Nobel Prizes in two different sciences.",
    source: "nobelprize.org/prizes/physics/1903/marie-curie/biographical",
  },
  {
    name: "Winston Churchill",
    date: "1874-11-30",
    blurb: "British statesman, Prime Minister during the Second World War.",
    source: "en.wikipedia.org/wiki/Early_life_of_Winston_Churchill",
  },
  {
    name: "Nikola Tesla",
    date: "1856-07-10",
    blurb: "Inventor and electrical engineer, pioneer of alternating-current power systems.",
    source: "en.wikipedia.org (Nikola Tesla)",
  },
  {
    name: "Frida Kahlo",
    date: "1907-07-06",
    blurb: "Mexican painter known for portraiture and works inspired by Mexican culture.",
    source: "en.wikipedia.org/wiki/Frida_Kahlo",
  },
  {
    name: "Martin Luther King Jr.",
    date: "1929-01-15",
    blurb: "Baptist minister and leader of the American civil rights movement.",
    source: "archives.gov / en.wikipedia.org/wiki/Martin_Luther_King_Jr.",
  },
  {
    name: "Ada Lovelace",
    date: "1815-12-10",
    blurb: "Mathematician, wrote the first algorithm intended for a computing machine.",
    source: "en.wikipedia.org/wiki/Ada_Lovelace",
  },
];

export default function FamousPeoplePage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof FIGURES)[number] | null>(null);
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = FIGURES.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  async function selectFigure(figure: (typeof FIGURES)[number]) {
    setSelected(figure);
    setChart(null);
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Sign in to view charts.");
        return;
      }
      const result = await postNatalChart(
        { datetime: `${figure.date}T12:00:00+00:00`, time_known: false },
        session.access_token
      );
      setChart(result);
    } catch {
      setError("Couldn't compute this chart — is the backend running? Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const sun = chart?.planets.find((p) => p.name === "Sun");

  return (
    <section className="screen active" id="famous-people">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Public figures
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Famous people</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Birth dates only, each individually verified — no birth times or coordinates are
        included since they aren&apos;t reliably documented for these figures, so charts here
        show planets and signs without houses or a Rising sign.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="famous-search">Search by name</label>
          <input
            id="famous-search"
            placeholder="Einstein, Curie, Tesla…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {filtered.map((f) => (
            <button
              key={f.name}
              className={`btn${selected?.name === f.name ? " btn-gold" : " btn-ghost"}`}
              onClick={() => selectFigure(f)}
            >
              {f.name}
            </button>
          ))}
          {filtered.length === 0 && <p className="sub">No matches.</p>}
        </div>
      </div>

      {selected && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 4px" }}>{selected.name}</h3>
          <p className="sub" style={{ margin: "0 0 4px" }}>
            Born {selected.date}
            {sun ? ` · Sun in ${zodiacSign(sun.longitude)}` : ""}
          </p>
          <p style={{ margin: "8px 0 0" }}>{selected.blurb}</p>
          <p className="sub" style={{ marginTop: 8, fontSize: 11 }}>
            Source: {selected.source}
          </p>
        </div>
      )}

      {loading && <p className="sub">Reading the sky…</p>}
      {error && <p style={{ color: "#c96a4a", fontSize: 13 }}>{error}</p>}

      {chart && !loading && (
        <div className="card" style={{ display: "flex", justifyContent: "center" }}>
          <ChartWheel chart={chart} />
        </div>
      )}
    </section>
  );
}
