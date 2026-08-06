"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import ElementModalityBreakdown from "@/components/ElementModalityBreakdown";
import NatalPlacementList from "@/components/NatalPlacementList";
import PositionTable from "@/components/PositionTable";
import type { NatalChart, SubscriptionTier } from "@/lib/api";
import { postSolarReturn } from "@/lib/api";
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

function currentYear(): number {
  return new Date().getFullYear();
}

export default function SolarReturnPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetYear, setTargetYear] = useState(currentYear());
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [exactDatetime, setExactDatetime] = useState<string | null>(null);
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
      const result = await postSolarReturn(
        {
          birth: {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: profileRow.latitude!, longitude: profileRow.longitude! } : {}),
          },
          target_year: targetYear,
          ...(hasLocation ? { latitude: profileRow.latitude!, longitude: profileRow.longitude! } : {}),
        },
        session.access_token
      );
      setChart(result.chart);
      setExactDatetime(result.exact_datetime);
    } catch {
      setError("Couldn't compute the solar return — is the backend running? Try again in a moment.");
    } finally {
      setComputing(false);
    }
  }

  if (tier === undefined || loading) return null;

  if (tier !== "practitioner") {
    return (
      <section className="screen active" id="solar-return">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Practitioner feature</span>
            <h2>Solar return</h2>
            <p className="sub">
              The chart cast for the exact moment the Sun returns to its natal position each
              year — a map of the themes for that birthday-to-birthday cycle. Part of Aureon
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
      <section className="screen active" id="solar-return">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Solar return</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              A solar return is built from your natal Sun position — create your profile to use
              it.
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
    <section className="screen active" id="solar-return">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Annual chart · exact solar return
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Solar return</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Cast for the precise moment the transiting Sun returns to your natal Sun&apos;s exact
        degree — the themes of your year from this birthday to the next.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="target-year">Year</label>
          <input
            id="target-year"
            type="number"
            value={targetYear}
            onChange={(e) => setTargetYear(Number(e.target.value))}
          />
        </div>
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
        <button
          className="btn btn-gold"
          style={{ marginTop: 14, opacity: computing ? 0.6 : 1 }}
          onClick={handleCompute}
          disabled={computing}
        >
          {computing ? "Casting…" : "Cast solar return"}
        </button>
      </div>

      {chart && (
        <>
          {exactDatetime && (
            <p className="sub" style={{ marginBottom: 16 }}>
              Exact return moment: <strong style={{ color: "var(--text)" }}>{exactDatetime}</strong>
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
        </>
      )}
    </section>
  );
}
