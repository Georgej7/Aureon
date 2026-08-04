"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import type { NatalChart, SubscriptionTier } from "@/lib/api";
import { postProgressedChart } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  birth_date: string | null;
  birth_time: string | null;
  latitude: number | null;
  longitude: number | null;
  utc_offset: number | null;
  subscription_tier: SubscriptionTier;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProgressedPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetDate, setTargetDate] = useState(todayIso());
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [progressedDatetime, setProgressedDatetime] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setTier("free");
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, birth_time, latitude, longitude, utc_offset, subscription_tier")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();
      if (cancelled) return;
      setTier(data?.subscription_tier ?? "free");
      setProfileRow(data ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCompute() {
    if (!profileRow?.birth_date) return;
    setComputing(true);
    setError(null);
    setChart(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired — please sign in again.");
        return;
      }
      const hasTime = !!profileRow.birth_time;
      const hasLocation = profileRow.latitude !== null && profileRow.longitude !== null;
      const datetime = `${profileRow.birth_date}T${hasTime ? profileRow.birth_time : "12:00"}:00${offsetToIso(
        profileRow.utc_offset ?? 0
      )}`;
      const result = await postProgressedChart(
        {
          birth: {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: profileRow.latitude!, longitude: profileRow.longitude! } : {}),
          },
          target_date: targetDate,
        },
        session.access_token
      );
      setChart(result.chart);
      setProgressedDatetime(result.progressed_datetime);
    } catch {
      setError("Couldn't compute the progressed chart — is the backend running? Try again in a moment.");
    } finally {
      setComputing(false);
    }
  }

  if (tier === undefined || loading) return null;

  if (tier !== "practitioner") {
    return (
      <section className="screen active" id="progressed">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Practitioner feature</span>
            <h2>Progressed chart</h2>
            <p className="sub">
              Secondary progressions — your natal chart advanced one symbolic day per year of
              life, showing how you&apos;ve psychologically developed since birth. Part of Aureon
              Practitioner.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Practitioner
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!profileRow?.birth_date) {
    return (
      <section className="screen active" id="progressed">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Progressed chart</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              Progressions are built from your natal chart — create your profile to use it.
            </p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="progressed">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Secondary progressions · a day for a year
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Progressed chart</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Your natal chart advanced one day for every year you&apos;ve lived — the slow inner
        development of your personality over time, distinct from the outer events shown by
        transits.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="target-date">As of</label>
          <input
            id="target-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
        <button
          className="btn btn-gold"
          style={{ marginTop: 14, opacity: computing ? 0.6 : 1 }}
          onClick={handleCompute}
          disabled={computing}
        >
          {computing ? "Progressing…" : "Compute progressed chart"}
        </button>
      </div>

      {chart && (
        <>
          {progressedDatetime && (
            <p className="sub" style={{ marginBottom: 16 }}>
              Progressed to: <strong style={{ color: "var(--text)" }}>{progressedDatetime}</strong>
            </p>
          )}
          <div className="card" style={{ display: "flex", justifyContent: "center" }}>
            <ChartWheel chart={chart} />
          </div>
        </>
      )}
    </section>
  );
}
