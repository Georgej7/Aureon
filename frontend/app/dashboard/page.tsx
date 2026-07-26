"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NatalChart, NumerologyProfile } from "@/lib/api";
import { zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  chart: NatalChart;
  numerology: NumerologyProfile;
  subscription_tier: "free" | "premium" | "vip";
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [manageLoading, setManageLoading] = useState<"payment" | "cancel" | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);

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
        .select("chart, numerology, subscription_tier")
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

  async function openManageUrl(kind: "payment" | "cancel") {
    setManageError(null);
    setManageLoading(kind);
    try {
      const res = await fetch("/api/subscription/manage");
      if (!res.ok) throw new Error();
      const { updatePaymentMethod, cancel } = await res.json();
      const url = kind === "payment" ? updatePaymentMethod : cancel;
      if (!url) throw new Error();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setManageError("Couldn't open the subscription portal. Try again in a moment.");
    } finally {
      setManageLoading(null);
    }
  }

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
          {profile?.subscription_tier === "premium" && (
            <div className="card">
              <div className="label">Subscription</div>
              <h3>Aureon Premium</h3>
              <p style={{ marginBottom: 14 }}>Manage your payment method or cancel anytime.</p>
              {manageError && (
                <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 10px" }}>{manageError}</p>
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn"
                  onClick={() => openManageUrl("payment")}
                  disabled={manageLoading !== null}
                >
                  {manageLoading === "payment" ? "Opening…" : "Update payment method"}
                </button>
                <button
                  className="btn"
                  onClick={() => openManageUrl("cancel")}
                  disabled={manageLoading !== null}
                >
                  {manageLoading === "cancel" ? "Opening…" : "Cancel subscription"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
