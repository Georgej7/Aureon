"use client";

import { useRef, useState } from "react";
import ChartReveal, { ChartRevealHandle } from "@/components/ChartReveal";
import { postNatalChart, postNumerology } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const chartRevealRef = useRef<ChartRevealHandle | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [utcOffset, setUtcOffset] = useState("0");
  const [birthLocation, setBirthLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLocation = latitude.trim() !== "" && longitude.trim() !== "";
  const locationValid =
    (latitude.trim() === "" || !Number.isNaN(Number(latitude))) &&
    (longitude.trim() === "" || !Number.isNaN(Number(longitude)));
  const hasTime = birthTime.trim() !== "";

  const canSubmit =
    fullName.trim() !== "" &&
    birthDate !== "" &&
    locationValid &&
    !Number.isNaN(Number(utcOffset));

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
            ...(hasLocation ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
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
        birth_location: birthLocation,
        latitude: hasLocation ? Number(latitude) : null,
        longitude: hasLocation ? Number(longitude) : null,
        utc_offset: Number(utcOffset),
        chart,
        numerology,
        updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;

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
          <div className="field">
            <label>Birth location</label>
            <input
              placeholder="Tbilisi, Georgia"
              value={birthLocation}
              onChange={(e) => setBirthLocation(e.target.value)}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Latitude (optional)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="41.7151"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Longitude (optional)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="44.8271"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
          <p className="sub" style={{ marginTop: -8, marginBottom: 16, textAlign: "left" }}>
            Don&apos;t know your exact birth coordinates? Leave these blank — you&apos;ll still get
            accurate planets and numerology, just without house placements like your Rising sign.
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
