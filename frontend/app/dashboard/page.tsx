"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import ElementModalityBreakdown from "@/components/ElementModalityBreakdown";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { KnowledgeEntry, NatalChart, NumerologyProfile, SubscriptionTier, Transits, TransitAspect } from "@/lib/api";
import { postTransits } from "@/lib/api";
import { birthstoneForSign, zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  chart: NatalChart;
  numerology: NumerologyProfile;
  subscription_tier: SubscriptionTier;
  subscription_status: "active" | "past_due" | "canceled" | "incomplete" | null;
};

// Slow-moving planets define a multi-week/month "theme"; fast ones define today's tone.
const SLOW_TRANSIT_PLANETS = new Set(["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]);
const FAST_TRANSIT_PLANETS = new Set(["Sun", "Moon", "Mercury", "Venus", "Mars"]);

const ASPECT_VERBS: Record<string, string> = {
  Conjunction: "meeting",
  Sextile: "opening an opportunity with",
  Square: "challenging",
  Trine: "supporting",
  Opposition: "in tension with",
};

function describeAspect(a: TransitAspect): string {
  const verb = ASPECT_VERBS[a.aspect_type] ?? a.aspect_type.toLowerCase();
  return `Transiting ${a.transiting_planet} is ${verb} your natal ${a.natal_planet} right now.`;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [transits, setTransits] = useState<Transits | null | undefined>(undefined);
  const [birthstoneEntry, setBirthstoneEntry] = useState<KnowledgeEntry | null>(null);
  const [manageLoading, setManageLoading] = useState<"payment" | "cancel" | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setProfile(null);
        return;
      }
      const user = session.user;
      const { data } = await supabase
        .from("profiles")
        .select("chart, numerology, subscription_tier, subscription_status")
        .eq("id", user.id)
        .maybeSingle();
      const loadedProfile =
        data && data.chart && data.numerology ? (data as Profile) : null;
      if (!cancelled) setProfile(loadedProfile);
      if (loadedProfile) {
        try {
          const result = await postTransits(
            {
              natal_planets: loadedProfile.chart.planets.map((p) => ({
                name: p.name,
                longitude: p.longitude,
              })),
            },
            session.access_token
          );
          if (!cancelled) setTransits(result);
        } catch {
          if (!cancelled) setTransits(null);
        }

        const loadedSun = loadedProfile.chart.planets.find((p) => p.name === "Sun");
        if (loadedSun) {
          const { data: stoneRow } = await supabase
            .from("knowledge_base")
            .select(
              "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes"
            )
            .eq("system", "western_astrology")
            .eq("category", "birthstone")
            .eq("topic", `${loadedSun.sign} Birthstone`)
            .maybeSingle();
          if (!cancelled) setBirthstoneEntry((stoneRow as KnowledgeEntry) ?? null);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const weeklyAspect = transits?.aspects.find((a) => SLOW_TRANSIT_PLANETS.has(a.transiting_planet));
  const dailyAspect = transits?.aspects.find((a) => FAST_TRANSIT_PLANETS.has(a.transiting_planet));
  const transitingMoon = transits?.transiting_planets.find((p) => p.name === "Moon");

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
      {profile && (
        <>
          <div className="print-hide" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn btn-ghost" onClick={() => window.print()}>
              Save as PDF / Print
            </button>
          </div>
          {profile.subscription_status === "past_due" && (
            <div
              className="card print-hide"
              style={{ marginBottom: 24, borderColor: "#c96a4a", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
            >
              <div>
                <div className="label" style={{ color: "#c96a4a" }}>Payment failed</div>
                <p style={{ margin: 0 }}>
                  We couldn&apos;t charge your card for your subscription. Update your payment method to keep your access.
                </p>
                {manageError && <p style={{ color: "#c96a4a", fontSize: 13, margin: "8px 0 0" }}>{manageError}</p>}
              </div>
              <button className="btn btn-gold" onClick={() => openManageUrl("payment")} disabled={manageLoading !== null}>
                {manageLoading === "payment" ? "Opening…" : "Update payment method"}
              </button>
            </div>
          )}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <ChartWheel chart={profile.chart} />
            <Link className="btn btn-ghost print-hide" href="/natal-report" style={{ marginTop: 16 }}>
              View full reading →
            </Link>
          </div>
        </>
      )}
      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="label">This week&apos;s theme</div>
            {weeklyAspect ? (
              <>
                <h3>
                  {weeklyAspect.transiting_planet} {weeklyAspect.aspect_type} {weeklyAspect.natal_planet}
                </h3>
                <p>{describeAspect(weeklyAspect)}</p>
              </>
            ) : (
              <>
                <h3>A quiet stretch</h3>
                <p>No major slow-moving transits are active right now — a good window for steady, unremarkable progress.</p>
              </>
            )}
          </div>
          <div className="card">
            <div className="label">Daily insight · Today</div>
            {dailyAspect ? (
              <>
                <h3>
                  {dailyAspect.transiting_planet} {dailyAspect.aspect_type} {dailyAspect.natal_planet}
                </h3>
                <p>{describeAspect(dailyAspect)}</p>
              </>
            ) : transitingMoon ? (
              <>
                <h3>Moon in {transitingMoon.sign}</h3>
                <p>No fast-moving aspects are exact today — a fairly even, low-drama day to work with.</p>
              </>
            ) : (
              <>
                <h3>Nothing to report yet</h3>
                <p>Complete your profile to see today&apos;s transits here.</p>
              </>
            )}
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
          {profile && <ElementModalityBreakdown chart={profile.chart} />}
          {profile && sunSign && (
            <div className="card">
              <div className="label">Birthstone</div>
              <h3>{birthstoneForSign(sunSign) ?? "—"}</h3>
              {birthstoneEntry && <p>{birthstoneEntry.definition}</p>}
            </div>
          )}
          {birthstoneEntry && (
            <div className="card">
              <div className="label">About your birthstone</div>
              <KnowledgeDetail entry={birthstoneEntry} />
            </div>
          )}
          {profile && profile.chart.patterns.length > 0 && (
            <div className="card">
              <div className="label">Chart patterns</div>
              {profile.chart.patterns.map((pattern, i) => (
                <p key={i} style={{ margin: i === 0 ? "0 0 6px" : "6px 0" }}>
                  <strong style={{ color: "var(--text)" }}>{pattern.pattern_type}</strong> —{" "}
                  {pattern.planets.join(", ")}
                  {pattern.apex && ` (apex: ${pattern.apex})`}
                </p>
              ))}
            </div>
          )}
          <div className="card">
            <div className="label">Moon phase</div>
            <h3>
              <span className="moon" />
              {transits?.moon_phase.name ?? "—"}
            </h3>
            {transitingMoon && <p>The Moon is currently in {transitingMoon.sign}.</p>}
          </div>
          {profile?.subscription_tier === "premium" && (
            <div className="card print-hide">
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
