"use client";

import { useRef, useState } from "react";
import ChartReveal, { ChartRevealHandle } from "@/components/ChartReveal";
import LocationField, { LocationValue } from "@/components/LocationField";
import { postNatalChart, postNumerology } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

const BLANK_LOCATION: LocationValue = { displayName: "", latitude: null, longitude: null };

export default function OnboardingPage() {
  const chartRevealRef = useRef<ChartRevealHandle | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [utcOffset, setUtcOffset] = useState("0");
  const [location, setLocation] = useState<LocationValue>(BLANK_LOCATION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLocation = location.latitude !== null && location.longitude !== null;
  const hasTime = birthTime.trim() !== "";

  const canSubmit = fullName.trim() !== "" && birthDate !== "" && !Number.isNaN(Number(utcOffset));

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("You need to be signed in to generate a profile.");
        setSubmitting(false);
        return;
      }
      const user = session.user;

      const datetime = `${birthDate}T${hasTime ? birthTime : "12:00"}:00${offsetToIso(Number(utcOffset))}`;
      const [chart, numerology] = await Promise.all([
        postNatalChart(
          {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: location.latitude!, longitude: location.longitude! } : {}),
          },
          session.access_token
        ),
        postNumerology({ full_name: fullName, date: birthDate }, session.access_token),
      ]);

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        birth_date: birthDate,
        birth_time: hasTime ? birthTime : null,
        birth_location: location.displayName,
        latitude: hasLocation ? location.latitude : null,
        longitude: hasLocation ? location.longitude : null,
        utc_offset: Number(utcOffset),
        chart,
        numerology,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

      trackEvent("onboarding_complete");
      chartRevealRef.current?.reveal();
    } catch {
      setError("Couldn't generate your profile — is the backend running? Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="screen active" id="onboard">
      <div className="onboard-wrap">
        <div className="step-dots">
          <span className="dot on" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="onboard-card hud">
          <span className="hud-tag">Profile intake</span>
          <h2>Let&apos;s build your profile</h2>
          <p className="sub">Just the essentials for now — your goals come after your first reading.</p>

          <div className="field">
            <label>Full name</label>
            <input
              placeholder="Jordan Rivera"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Date of birth</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Birth time (optional)</label>
              <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </div>
          </div>
          <p className="sub" style={{ marginTop: -8, marginBottom: 16, textAlign: "left" }}>
            Don&apos;t know your exact birth time? Leave it blank — you&apos;ll still get accurate
            planets and numerology, just without house placements like your Rising sign.
          </p>
          <LocationField label="Birth location" value={location} onChange={setLocation} />
          <p className="sub" style={{ marginTop: -8, marginBottom: 16, textAlign: "left" }}>
            Pick your birth city from the suggestions so it resolves to real coordinates — typing
            a name without selecting one won&apos;t give you house placements like your Rising
            sign. Don&apos;t know your birth city precisely? Leave it blank instead; you&apos;ll
            still get accurate planets and numerology.
          </p>
          <div className="field">
            <label>UTC offset at birth (e.g. -5, 4, 5.5)</label>
            <input
              type="number"
              step="0.5"
              placeholder="4"
              value={utcOffset}
              onChange={(e) => setUtcOffset(e.target.value)}
            />
          </div>

          {error && (
            <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 8px" }}>{error}</p>
          )}

          <button
            className="btn btn-gold"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            style={{ opacity: !canSubmit || submitting ? 0.6 : 1 }}
          >
            {submitting ? "Reading the sky…" : "Generate my profile"}
          </button>
        </div>
      </div>

      <ChartReveal ref={chartRevealRef} />
    </section>
  );
}
