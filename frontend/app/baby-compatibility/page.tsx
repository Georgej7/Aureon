"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import LocationField, { LocationValue } from "@/components/LocationField";
import type { KnowledgeEntry, SubscriptionTier, Synastry } from "@/lib/api";
import { postSynastry } from "@/lib/api";
import { offsetToIso, zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type PersonInput = {
  name: string;
  birthDate: string;
  birthTime: string;
  location: LocationValue;
  utcOffset: string;
};

const BLANK_PERSON: PersonInput = {
  name: "",
  birthDate: "",
  birthTime: "",
  location: { displayName: "", latitude: null, longitude: null },
  utcOffset: "0",
};

// Family/parenting themes read from the same synastry aspect set the
// Compatibility tool uses, just grouped by which planet pair the theme cares
// about instead of shown as one flat list -- Moon governs nurturing/emotional
// security, Saturn governs structure/responsibility, Mercury governs how the
// two of you actually talk things through day to day.
const THEMES: { title: string; blurb: string; planets: string[] }[] = [
  {
    title: "Nurturing & emotional security",
    blurb: "How your instincts for comfort, routine, and emotional safety line up as co-parents.",
    planets: ["Moon", "Venus"],
  },
  {
    title: "Structure & responsibility",
    blurb: "How you divide discipline, follow-through, and the unglamorous logistics of raising a kid.",
    planets: ["Saturn", "Sun"],
  },
  {
    title: "Communication under pressure",
    blurb: "How you talk things through when you disagree on a parenting call.",
    planets: ["Mercury", "Mars"],
  },
];

function toBirthDataPayload(person: PersonInput) {
  const hasTime = person.birthTime.trim() !== "";
  const hasLocation = person.location.latitude !== null && person.location.longitude !== null;
  const datetime = `${person.birthDate}T${hasTime ? person.birthTime : "12:00"}:00${offsetToIso(
    Number(person.utcOffset)
  )}`;
  return {
    datetime,
    time_known: hasTime,
    ...(hasLocation ? { latitude: person.location.latitude!, longitude: person.location.longitude! } : {}),
  };
}

function PersonForm({
  title,
  person,
  onChange,
}: {
  title: string;
  person: PersonInput;
  onChange: (next: PersonInput) => void;
}) {
  return (
    <div className="card">
      <div className="label">{title}</div>
      <div className="field">
        <label>Name</label>
        <input
          placeholder="Jordan Rivera"
          value={person.name}
          onChange={(e) => onChange({ ...person, name: e.target.value })}
        />
      </div>
      <div className="row2">
        <div className="field">
          <label>Date of birth</label>
          <input
            type="date"
            value={person.birthDate}
            onChange={(e) => onChange({ ...person, birthDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Birth time (optional)</label>
          <input
            type="time"
            value={person.birthTime}
            onChange={(e) => onChange({ ...person, birthTime: e.target.value })}
          />
        </div>
      </div>
      <LocationField
        label="Birth location (optional)"
        value={person.location}
        onChange={(location) => onChange({ ...person, location })}
      />
      <div className="field">
        <label>UTC offset at birth</label>
        <input
          type="number"
          step="0.5"
          value={person.utcOffset}
          onChange={(e) => onChange({ ...person, utcOffset: e.target.value })}
        />
      </div>
    </div>
  );
}

export default function BabyCompatibilityPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [personA, setPersonA] = useState<PersonInput>(BLANK_PERSON);
  const [personB, setPersonB] = useState<PersonInput>(BLANK_PERSON);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Synastry | null>(null);
  const [aspectContent, setAspectContent] = useState<Record<string, KnowledgeEntry>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setTier("free");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, birth_date, birth_time, birth_location, latitude, longitude, utc_offset, subscription_tier")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setTier((data?.subscription_tier as SubscriptionTier) ?? "free");
      if (data?.birth_date) {
        setPersonA({
          name: data.full_name ?? "You",
          birthDate: data.birth_date,
          birthTime: data.birth_time ?? "",
          location: {
            displayName: data.birth_location ?? "",
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
          },
          utcOffset: data.utc_offset !== null && data.utc_offset !== undefined ? String(data.utc_offset) : "0",
        });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    personA.name.trim() !== "" &&
    personA.birthDate !== "" &&
    personB.name.trim() !== "" &&
    personB.birthDate !== "";

  async function handleCompare() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("You need to be signed in to check compatibility.");
        setSubmitting(false);
        return;
      }

      const synastry = await postSynastry(
        {
          person_a: toBirthDataPayload(personA),
          person_b: toBirthDataPayload(personB),
        },
        session.access_token
      );
      setResult(synastry);

      const aspectTypes = Array.from(new Set(synastry.aspects.map((a) => `Synastry ${a.aspect_type}`)));
      if (aspectTypes.length > 0) {
        const { data: entries } = await supabase
          .from("knowledge_base")
          .select(
            "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes"
          )
          .in("topic", aspectTypes);
        const byTopic: Record<string, KnowledgeEntry> = {};
        for (const entry of (entries as KnowledgeEntry[]) ?? []) byTopic[entry.topic] = entry;
        setAspectContent(byTopic);
      }
    } catch {
      setError("Couldn't compute compatibility — is the backend running? Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tier === undefined) return null;

  if (tier === "free") {
    return (
      <section className="screen active" id="baby-compatibility">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Premium feature</span>
            <h2>Baby &amp; family compatibility</h2>
            <p className="sub">
              See how two parents&apos; charts line up on nurturing, structure, and communication —
              part of Aureon Premium.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const aspectsByPlanetPair: SynastryAspectWithTheme[] = result
    ? result.aspects.map((a) => ({
        ...a,
        themes: THEMES.filter((t) => t.planets.includes(a.person_a_planet) || t.planets.includes(a.person_b_planet)).map(
          (t) => t.title
        ),
      }))
    : [];

  return (
    <section className="screen active" id="baby-compatibility">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Family synastry
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Baby &amp; family compatibility</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        This uses the same synastry aspect math as our romantic compatibility tool — the sky
        doesn&apos;t know why two charts are being compared — but reads the results through a
        parenting lens: nurturing style, shared structure, and how you communicate under
        pressure, instead of romance and attraction.
      </p>

      <div className="dash-grid">
        <PersonForm title="Parent A" person={personA} onChange={setPersonA} />
        <PersonForm title="Parent B" person={personB} onChange={setPersonB} />
      </div>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "16px 0 0" }}>{error}</p>}

      <button
        className="btn btn-gold"
        style={{ marginTop: 20, opacity: !canSubmit || submitting ? 0.6 : 1 }}
        onClick={handleCompare}
        disabled={!canSubmit || submitting}
      >
        {submitting ? "Reading both skies…" : "Check compatibility"}
      </button>

      {result && (
        <div style={{ marginTop: 32 }}>
          <div className="card">
            <div className="label">Snapshot</div>
            <div className="stat-row">
              <div className="stat">
                <div className="val">
                  {zodiacSign(result.person_a.planets.find((p) => p.name === "Moon")?.longitude ?? 0)}
                </div>
                <div className="lbl">{personA.name || "Parent A"}&apos;s Moon (nurturing style)</div>
              </div>
              <div className="stat">
                <div className="val">
                  {zodiacSign(result.person_b.planets.find((p) => p.name === "Moon")?.longitude ?? 0)}
                </div>
                <div className="lbl">{personB.name || "Parent B"}&apos;s Moon (nurturing style)</div>
              </div>
              <div className="stat">
                <div className="val">{result.aspects.length}</div>
                <div className="lbl">Aspects found</div>
              </div>
            </div>
          </div>

          {THEMES.map((theme) => {
            const themeAspects = aspectsByPlanetPair.filter((a) => a.themes.includes(theme.title));
            if (themeAspects.length === 0) return null;
            return (
              <div className="card" key={theme.title}>
                <div className="label">{theme.title}</div>
                <p style={{ marginBottom: 12, color: "var(--text-dim)" }}>{theme.blurb}</p>
                {themeAspects.map((a, i) => {
                  const content = aspectContent[`Synastry ${a.aspect_type}`];
                  return (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 14 }}>
                        {personA.name || "Parent A"}&apos;s {a.person_a_planet} {a.aspect_type}{" "}
                        {personB.name || "Parent B"}&apos;s {a.person_b_planet} (orb {a.orb.toFixed(1)}°)
                      </p>
                      {content && <KnowledgeDetail entry={content} />}
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="card">
            <div className="label">Every aspect found</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
              {result.aspects.map((a, i) => (
                <li key={i}>
                  {personA.name || "Parent A"}&apos;s {a.person_a_planet} {a.aspect_type}{" "}
                  {personB.name || "Parent B"}&apos;s {a.person_b_planet} (orb {a.orb.toFixed(1)}°)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

type SynastryAspectWithTheme = Synastry["aspects"][number] & { themes: string[] };
