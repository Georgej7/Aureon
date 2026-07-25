"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NatalChart, NumerologyProfile } from "@/lib/api";
import { zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  chart: NatalChart;
  numerology: NumerologyProfile;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("chart, numerology")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setProfile(data && data.chart && data.numerology ? (data as Profile) : null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sun = profile?.chart.planets.find((p) => p.name === "Sun");
  const sunSign = sun ? zodiacSign(sun.longitude) : null;
  const risingSign =
    profile && profile.chart.ascendant !== null ? zodiacSign(profile.chart.ascendant) : null;

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
                  <div className="val">{risingSign ?? "—"}</div>
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
