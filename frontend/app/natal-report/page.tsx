"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { KnowledgeEntry, NatalChart, PlanetPlacement } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const KNOWLEDGE_COLUMNS =
  "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes";

type Placement = { name: string; glyph: string; sign: string; sign_degree: number; house: number | null; retrograde: boolean };

const GLYPHS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
  Lilith: "⚸", Chiron: "⚷", Ceres: "⚳", Pallas: "⚴", Juno: "⚵", Vesta: "⚶",
};

function chartPlacements(chart: NatalChart): Placement[] {
  const fromPoint = (p: PlanetPlacement): Placement => ({
    name: p.name, glyph: GLYPHS[p.name] ?? "•", sign: p.sign, sign_degree: p.sign_degree,
    house: p.house, retrograde: p.retrograde,
  });
  return [
    ...chart.planets.map(fromPoint),
    fromPoint(chart.lilith), fromPoint(chart.chiron), fromPoint(chart.ceres),
    fromPoint(chart.pallas), fromPoint(chart.juno), fromPoint(chart.vesta),
  ];
}

function PlacementCard({
  placement,
  planetEntry,
  signEntry,
  houseEntry,
}: {
  placement: Placement;
  planetEntry: KnowledgeEntry | undefined;
  signEntry: KnowledgeEntry | undefined;
  houseEntry: KnowledgeEntry | undefined;
}) {
  const [open, setOpen] = useState(false);
  const summary = planetEntry?.definition ?? signEntry?.definition ?? "";

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset", cursor: "pointer", display: "flex", width: "100%",
          justifyContent: "space-between", alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: "0 0 4px" }}>
            {placement.glyph} {placement.name} in {placement.sign}
            {placement.retrograde ? " (retrograde)" : ""}
          </h3>
          <p className="sub" style={{ margin: 0 }}>
            {placement.sign_degree.toFixed(1)}°{placement.house !== null ? ` · House ${placement.house}` : ""}
          </p>
        </div>
        <span style={{ color: "var(--gold-soft)", fontSize: 20 }}>{open ? "−" : "+"}</span>
      </button>
      {!open && summary && (
        <p style={{ marginTop: 10, marginBottom: 0, color: "var(--text-dim)" }}>{summary}</p>
      )}
      {open && (
        <div style={{ marginTop: 16 }}>
          {planetEntry && (
            <>
              <div className="label">{placement.name}</div>
              <KnowledgeDetail entry={planetEntry} />
            </>
          )}
          {signEntry && (
            <>
              <div className="label">{placement.sign}</div>
              <KnowledgeDetail entry={signEntry} />
            </>
          )}
          {houseEntry && placement.house !== null && (
            <>
              <div className="label">House {placement.house}</div>
              <KnowledgeDetail entry={houseEntry} />
            </>
          )}
          {!planetEntry && !signEntry && !houseEntry && (
            <p className="sub">No written interpretation on file for this placement yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NatalReportPage() {
  const [chart, setChart] = useState<NatalChart | null | undefined>(undefined);
  const [knowledge, setKnowledge] = useState<Record<string, KnowledgeEntry>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setChart(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("chart")
        .eq("id", session.user.id)
        .maybeSingle<{ chart: NatalChart | null }>();
      const loadedChart = data?.chart ?? null;
      if (!cancelled) setChart(loadedChart);
      if (!loadedChart) return;

      const placements = chartPlacements(loadedChart);
      const topics = new Set<string>();
      for (const p of placements) {
        topics.add(p.name);
        topics.add(p.sign);
        if (p.house !== null) topics.add(`House ${p.house}`);
      }
      const { data: entries } = await supabase
        .from("knowledge_base")
        .select(KNOWLEDGE_COLUMNS)
        .in("topic", Array.from(topics));
      if (cancelled) return;
      const byTopic: Record<string, KnowledgeEntry> = {};
      for (const entry of (entries as KnowledgeEntry[]) ?? []) byTopic[entry.topic] = entry;
      setKnowledge(byTopic);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (chart === undefined) return null;

  if (!chart) {
    return (
      <section className="screen active" id="natal-report">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Full natal reading</span>
            <h2>Complete your profile first</h2>
            <p className="sub">Create your profile to see your full placement-by-placement reading.</p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const placements = chartPlacements(chart);

  return (
    <section className="screen active" id="natal-report">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Every placement, explained
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Full natal reading</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Tap any placement to expand its full interpretation — traditional, modern, and
        psychological readings, plus strengths, challenges, career, relationships, and growth.
      </p>
      {placements.map((p) => (
        <PlacementCard
          key={p.name}
          placement={p}
          planetEntry={knowledge[p.name]}
          signEntry={knowledge[p.sign]}
          houseEntry={p.house !== null ? knowledge[`House ${p.house}`] : undefined}
        />
      ))}
    </section>
  );
}
