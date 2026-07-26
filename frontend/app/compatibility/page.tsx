"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KnowledgeEntry, Synastry } from "@/lib/api";
import { postSynastry } from "@/lib/api";
import { offsetToIso, zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type PersonInput = {
  name: string;
  birthDate: string;
  birthTime: string;
  latitude: string;
  longitude: string;
  utcOffset: string;
};

const BLANK_PERSON: PersonInput = {
  name: "",
  birthDate: "",
  birthTime: "",
  latitude: "",
  longitude: "",
  utcOffset: "0",
};

function toBirthDataPayload(person: PersonInput) {
  const hasTime = person.birthTime.trim() !== "";
  const hasLocation = person.latitude.trim() !== "" && person.longitude.trim() !== "";
  const datetime = `${person.birthDate}T${hasTime ? person.birthTime : "12:00"}:00${offsetToIso(
    Number(person.utcOffset)
  )}`;
  return {
    datetime,
    time_known: hasTime,
    ...(hasLocation ? { latitude: Number(person.latitude), longitude: Number(person.longitude) } : {}),
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
      <div className="row2">
        <div className="field">
          <label>Latitude (optional)</label>
          <input
            type="number"
            step="0.0001"
            value={person.latitude}
            onChange={(e) => onChange({ ...person, latitude: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Longitude (optional)</label>
          <input
            type="number"
            step="0.0001"
            value={person.longitude}
            onChange={(e) => onChange({ ...person, longitude: e.target.value })}
          />
        </div>
      </div>
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

export default function CompatibilityPage() {
  const [tier, setTier] = useState<"free" | "premium" | "vip" | undefined>(undefined);
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
        .select("full_name, birth_date, birth_time, latitude, longitude, utc_offset, subscription_tier")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setTier((data?.subscription_tier as "free" | "premium" | "vip") ?? "free");
      if (data?.birth_date) {
        setPersonA({
          name: data.full_name ?? "You",
          birthDate: data.birth_date,
          birthTime: data.birth_time ?? "",
          latitude: data.latitude !== null && data.latitude !== undefined ? String(data.latitude) : "",
          longitude:
            data.longitude !== null && data.longitude !== undefined ? String(data.longitude) : "",
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
        setError("You need to be signed in to compare charts.");
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
      <section className="screen active" id="compatibility">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Premium feature</span>
            <h2>Compatibility analysis</h2>
            <p className="sub">
              Compare your chart with someone else&apos;s and see how your planets interact — this
              is part of Aureon Premium.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const aspectsByType: Record<string, Synastry["aspects"]> = {};
  if (result) {
    for (const aspect of result.aspects) {
      (aspectsByType[aspect.aspect_type] ??= []).push(aspect);
    }
  }

  return (
    <section className="screen active" id="compatibility">
      <div className="dash-grid">
        <PersonForm title="Person A" person={personA} onChange={setPersonA} />
        <PersonForm title="Person B" person={personB} onChange={setPersonB} />
      </div>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "16px 0 0" }}>{error}</p>}

      <button
        className="btn btn-gold"
        style={{ marginTop: 20, opacity: !canSubmit || submitting ? 0.6 : 1 }}
        onClick={handleCompare}
        disabled={!canSubmit || submitting}
      >
        {submitting ? "Reading both skies…" : "Compare charts"}
      </button>

      {result && (
        <div style={{ marginTop: 32 }}>
          <div className="card">
            <div className="label">Snapshot</div>
            <div className="stat-row">
              <div className="stat">
                <div className="val">
                  {zodiacSign(result.person_a.planets.find((p) => p.name === "Sun")?.longitude ?? 0)}
                </div>
                <div className="lbl">{personA.name || "Person A"}&apos;s Sun</div>
              </div>
              <div className="stat">
                <div className="val">
                  {zodiacSign(result.person_b.planets.find((p) => p.name === "Sun")?.longitude ?? 0)}
                </div>
                <div className="lbl">{personB.name || "Person B"}&apos;s Sun</div>
              </div>
              <div className="stat">
                <div className="val">{result.aspects.length}</div>
                <div className="lbl">Aspects found</div>
              </div>
            </div>
          </div>

          {Object.entries(aspectsByType).map(([aspectType, aspects]) => {
            const content = aspectContent[`Synastry ${aspectType}`];
            return (
              <div className="card" key={aspectType}>
                <div className="label">{aspectType}</div>
                {content && <p style={{ marginBottom: 12 }}>{content.definition}</p>}
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
                  {aspects.map((a, i) => (
                    <li key={i}>
                      {personA.name || "Person A"}&apos;s {a.person_a_planet} — {personB.name || "Person B"}
                      &apos;s {a.person_b_planet} (orb {a.orb.toFixed(1)}°)
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
