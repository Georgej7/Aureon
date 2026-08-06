"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HumanDesignBodygraph from "@/components/HumanDesignBodygraph";
import type { HumanDesignChart } from "@/lib/api";
import { postHumanDesignChart } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  birth_date: string | null;
  birth_time: string | null;
  utc_offset: number | null;
};

export default function HumanDesignPage() {
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [chart, setChart] = useState<HumanDesignChart | null>(null);
  const [loading, setLoading] = useState(true);
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
          setHasProfile(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, birth_time, utc_offset")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();
      if (cancelled) return;
      if (!data?.birth_date) {
        setHasProfile(false);
        setLoading(false);
        return;
      }
      setHasProfile(true);
      try {
        const datetime = `${data.birth_date}T${data.birth_time ?? "12:00"}:00${offsetToIso(
          data.utc_offset ?? 0
        )}`;
        const result = await postHumanDesignChart(datetime, session.access_token);
        if (!cancelled) setChart(result);
      } catch {
        if (!cancelled) setError("Couldn't compute your Human Design chart — is the backend running? Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hasProfile === undefined || loading) return null;

  if (!hasProfile) {
    return (
      <section className="screen active" id="human-design">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Human Design</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              Human Design needs an exact birth date, time, and place to compute — create your
              profile to see it.
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
    <section className="screen active" id="human-design">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Type · Strategy · Authority · Profile
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Human Design</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        A synthesis of astrology, the I Ching, Kabbalah, and chakra systems — built from your
        exact birth chart plus a second chart cast 88° of solar arc before you were born.
      </p>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {chart && (
        <>
          <div className="card" style={{ display: "flex", justifyContent: "center" }}>
            <HumanDesignBodygraph chart={chart} />
          </div>
          <div className="card">
            <div className="stat-row">
              <div className="stat">
                <div className="val">{chart.type}</div>
                <div className="lbl">Type</div>
              </div>
              <div className="stat">
                <div className="val">{chart.authority}</div>
                <div className="lbl">Authority</div>
              </div>
              <div className="stat">
                <div className="val">{chart.profile}</div>
                <div className="lbl">Profile</div>
              </div>
              <div className="stat">
                <div className="val">{chart.definition}</div>
                <div className="lbl">Definition</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="label">Strategy</div>
            <p>{chart.strategy}</p>
          </div>
          {chart.active_channels.length > 0 && (
            <div className="card">
              <div className="label">Active channels</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
                {chart.active_channels.map((c) => (
                  <li key={c.gates.join("-")}>
                    {c.gates[0]}–{c.gates[1]} · {c.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="dash-grid">
            <div className="card">
              <div className="label">Defined centers</div>
              {chart.defined_centers.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
                  {chart.defined_centers.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="sub">None — a fully open chart.</p>
              )}
            </div>
            <div className="card">
              <div className="label">Undefined centers</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
                {chart.undefined_centers.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="card">
            <div className="label">Active gates</div>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
              {chart.active_gates.join(", ")}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
