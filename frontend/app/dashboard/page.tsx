"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NatalChart, NumerologyProfile } from "@/lib/api";
import { zodiacSign } from "@/lib/astrology";

type StoredProfile = {
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  chart: NatalChart;
  numerology: NumerologyProfile;
};

// Stopgap only: real persistence (Supabase/Postgres) hasn't been built yet, so
// the onboarding result is kept in localStorage until then.
function loadStoredProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem("aureon_profile");
    return raw ? (JSON.parse(raw) as StoredProfile) : null;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<StoredProfile | null | undefined>(undefined);

  useEffect(() => {
    setProfile(loadStoredProfile());
  }, []);

  const sun = profile?.chart.planets.find((p) => p.name === "Sun");
  const sunSign = sun ? zodiacSign(sun.longitude) : null;
  const risingSign = profile ? zodiacSign(profile.chart.ascendant) : null;

  return (
    <section className="screen active" id="dashboard">
      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="label">This week&apos;s theme</div>
            <h3>Structure before speed</h3>
            <p>
              Your Saturn transit and Personal Year 8 are both asking for patience right now — a
              rare alignment worth planning around rather than pushing past.
            </p>
          </div>
          <div className="card">
            <div className="label">Daily insight · Today</div>
            <h3>Moon in Taurus</h3>
            <p>A grounded, low-drama day. Good for finishing what you started rather than beginning something new.</p>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="label">Snapshot</div>
            {profile === undefined ? null : profile === null ? (
              <>
                <p style={{ marginBottom: 14 }}>
                  Complete your profile to see your natal snapshot here.
                </p>
                <Link className="btn btn-gold" href="/onboarding">
                  Create your profile
                </Link>
              </>
            ) : (
              <div className="stat-row">
                <div className="stat">
                  <div className="val">Life {profile.numerology.life_path}</div>
                  <div className="lbl">Path</div>
                </div>
                <div className="stat">
                  <div className="val">{sunSign}</div>
                  <div className="lbl">Sun</div>
                </div>
                <div className="stat">
                  <div className="val">{risingSign}</div>
                  <div className="lbl">Rising</div>
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="label">Moon phase</div>
            <h3>
              <span className="moon" />
              Waxing gibbous
            </h3>
            <p>
              Full moon in 4 days — a good window to notice what&apos;s building toward completion
              in your own timeline.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
