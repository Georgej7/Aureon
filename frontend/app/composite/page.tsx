"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import LocationField, { LocationValue } from "@/components/LocationField";
import ElementModalityBreakdown from "@/components/ElementModalityBreakdown";
import NatalPlacementList from "@/components/NatalPlacementList";
import PositionTable from "@/components/PositionTable";
import type { NatalChart, SubscriptionTier } from "@/lib/api";
import { postCompositeChart, postDavisonChart } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
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

export default function CompositePage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [method, setMethod] = useState<"composite" | "davison">("composite");
  const [personA, setPersonA] = useState<PersonInput>(BLANK_PERSON);
  const [personB, setPersonB] = useState<PersonInput>(BLANK_PERSON);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [midpointDatetime, setMidpointDatetime] = useState<string | null>(null);

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

  async function handleCompute() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setChart(null);
    setMidpointDatetime(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("You need to be signed in to compute this chart.");
        setSubmitting(false);
        return;
      }

      if (method === "composite") {
        const result = await postCompositeChart(
          { person_a: toBirthDataPayload(personA), person_b: toBirthDataPayload(personB) },
          session.access_token
        );
        setChart(result);
      } else {
        const result = await postDavisonChart(
          { person_a: toBirthDataPayload(personA), person_b: toBirthDataPayload(personB) },
          session.access_token
        );
        setChart(result.chart);
        setMidpointDatetime(result.midpoint_datetime);
      }
    } catch {
      setError("Couldn't compute the chart — is the backend running? Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tier === undefined) return null;

  if (tier !== "practitioner") {
    return (
      <section className="screen active" id="composite">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Practitioner feature</span>
            <h2>Composite &amp; Davison charts</h2>
            <p className="sub">
              Two ways of reading a relationship as its own entity: a composite chart (built
              from the midpoint of each planet pair) or a Davison chart (a real chart cast for
              the midpoint moment and place in time). Part of Aureon Practitioner.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Practitioner
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="composite">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Relationship charts
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Composite &amp; Davison</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Composite averages each planet pair&apos;s midpoint into a single symbolic chart.
        Davison casts a real chart for the actual midpoint moment and location between the two
        birth events — different methods, both used to read a relationship as its own entity.
      </p>

      <div className="billing-toggle" style={{ marginBottom: 20 }}>
        <button className={method === "composite" ? "active" : ""} onClick={() => setMethod("composite")}>
          Composite
        </button>
        <button className={method === "davison" ? "active" : ""} onClick={() => setMethod("davison")}>
          Davison
        </button>
      </div>

      <div className="dash-grid">
        <PersonForm title="Person A" person={personA} onChange={setPersonA} />
        <PersonForm title="Person B" person={personB} onChange={setPersonB} />
      </div>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "16px 0 0" }}>{error}</p>}

      <button
        className="btn btn-gold"
        style={{ marginTop: 20, opacity: !canSubmit || submitting ? 0.6 : 1 }}
        onClick={handleCompute}
        disabled={!canSubmit || submitting}
      >
        {submitting ? "Reading both skies…" : `Compute ${method} chart`}
      </button>

      {chart && (
        <div style={{ marginTop: 32 }}>
          {midpointDatetime && (
            <p className="sub" style={{ marginBottom: 16 }}>
              Midpoint moment: <strong style={{ color: "var(--text)" }}>{midpointDatetime}</strong>
            </p>
          )}
          <div className="card" style={{ display: "flex", justifyContent: "center" }}>
            <ChartWheel chart={chart} />
          </div>
          <div className="dash-grid" style={{ margin: "20px 0" }}>
            <PositionTable chart={chart} />
            <ElementModalityBreakdown chart={chart} />
          </div>
          <NatalPlacementList chart={chart} />
        </div>
      )}
    </section>
  );
}
