"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { KnowledgeEntry, SubscriptionTier, VedicChart } from "@/lib/api";
import { postVedicChart } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  full_name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  latitude: number | null;
  longitude: number | null;
  utc_offset: number | null;
  subscription_tier: SubscriptionTier;
};

function yearOf(iso: string): string {
  return new Date(iso).getUTCFullYear().toString();
}

export default function VedicPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [chart, setChart] = useState<VedicChart | null>(null);
  const [content, setContent] = useState<Record<string, KnowledgeEntry>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        .select("full_name, birth_date, birth_time, latitude, longitude, utc_offset, subscription_tier")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();

      if (cancelled) return;
      const resolvedTier = data?.subscription_tier ?? "free";
      setTier(resolvedTier);
      setHasProfile(!!data?.birth_date);

      if (resolvedTier === "free" || !data?.birth_date) {
        setLoading(false);
        return;
      }

      try {
        const hasTime = !!data.birth_time;
        const hasLocation = data.latitude !== null && data.longitude !== null;
        const datetime = `${data.birth_date}T${hasTime ? data.birth_time : "12:00"}:00${offsetToIso(
          data.utc_offset ?? 0
        )}`;
        const result = await postVedicChart(
          {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: data.latitude!, longitude: data.longitude! } : {}),
          },
          session.access_token
        );
        if (cancelled) return;
        setChart(result);

        const topics = [
          result.moon_nakshatra.name,
          result.ascendant_nakshatra?.name,
          `${result.current_mahadasha.lord} Mahadasha`,
          "Navamsa Chart",
          ...result.yogas.map((y) => y.yoga_type),
        ].filter((t): t is string => !!t);
        const { data: entries } = await supabase
          .from("knowledge_base")
          .select(
            "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes"
          )
          .in("topic", topics);
        if (cancelled) return;
        const byTopic: Record<string, KnowledgeEntry> = {};
        for (const entry of (entries as KnowledgeEntry[]) ?? []) byTopic[entry.topic] = entry;
        setContent(byTopic);
      } catch {
        if (!cancelled) setError("Couldn't compute your Vedic chart — is the backend running? Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (tier === undefined || loading) return null;

  if (tier === "free") {
    return (
      <section className="screen active" id="vedic">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Premium feature</span>
            <h2>Vedic astrology</h2>
            <p className="sub">
              Your sidereal chart, nakshatra, and current planetary period (Mahadasha) — a
              different, older tradition from the Western chart you already have. Part of Aureon
              Premium.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!hasProfile) {
    return (
      <section className="screen active" id="vedic">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Vedic astrology</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              Your Vedic chart is built from the same birth details as your Western chart —
              create your profile to see it.
            </p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="screen active" id="vedic">
        <p style={{ color: "#c96a4a", fontSize: 14 }}>{error}</p>
      </section>
    );
  }

  if (!chart) return null;

  const moonContent = content[chart.moon_nakshatra.name];
  const ascContent = chart.ascendant_nakshatra ? content[chart.ascendant_nakshatra.name] : null;
  const dashaContent = content[`${chart.current_mahadasha.lord} Mahadasha`];
  const navamsaContent = content["Navamsa Chart"];
  const rahu = chart.planets.find((p) => p.name === "Rahu");
  const ketu = chart.planets.find((p) => p.name === "Ketu");
  const moonNavamsa = chart.navamsa.find((n) => n.name === "Moon");

  return (
    <section className="screen active" id="vedic">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Sidereal chart · Lahiri ayanamsa
      </p>
      <h2 style={{ margin: "0 0 24px" }}>Your Vedic chart</h2>

      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="label">Moon nakshatra</div>
            <h3>{chart.moon_nakshatra.name}</h3>
            <p style={{ marginBottom: moonContent ? 12 : 0 }}>
              Ruled by {chart.moon_nakshatra.ruling_planet} ·{" "}
              {Math.round(chart.moon_nakshatra.elapsed_fraction * 100)}% through this nakshatra
            </p>
            {moonContent && <p>{moonContent.definition}</p>}
          </div>
          {moonContent && (
            <div className="card">
              <div className="label">About {chart.moon_nakshatra.name}</div>
              <KnowledgeDetail entry={moonContent} />
            </div>
          )}

          {chart.ascendant_sign && chart.ascendant_nakshatra && (
            <div className="card">
              <div className="label">Ascendant (Lagna)</div>
              <h3>{chart.ascendant_sign}</h3>
              <p style={{ marginBottom: ascContent ? 12 : 0 }}>
                {chart.ascendant_nakshatra.name} nakshatra, ruled by{" "}
                {chart.ascendant_nakshatra.ruling_planet}
              </p>
              {ascContent && <p>{ascContent.definition}</p>}
            </div>
          )}
          {ascContent && (
            <div className="card">
              <div className="label">About {chart.ascendant_nakshatra?.name}</div>
              <KnowledgeDetail entry={ascContent} />
            </div>
          )}

          <div className="card">
            <div className="label">Rahu &amp; Ketu</div>
            <p>
              Rahu in {rahu?.sign ?? "—"} · Ketu in {ketu?.sign ?? "—"}
            </p>
          </div>

          {moonNavamsa && (
            <div className="card">
              <div className="label">Navamsa (D9)</div>
              <h3>Moon in {moonNavamsa.sign}</h3>
              <p style={{ marginBottom: navamsaContent ? 12 : 0 }}>
                Your Moon's finer-grained placement in the D9 chart — a second, complementary
                layer read especially for inner disposition and committed partnership.
              </p>
              {navamsaContent && <p>{navamsaContent.definition}</p>}
            </div>
          )}
          {navamsaContent && (
            <div className="card">
              <div className="label">About the Navamsa Chart</div>
              <KnowledgeDetail entry={navamsaContent} />
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="label">Current Mahadasha</div>
            <h3>{chart.current_mahadasha.lord}</h3>
            <p style={{ marginBottom: dashaContent ? 12 : 0 }}>
              {yearOf(chart.current_mahadasha.start)} – {yearOf(chart.current_mahadasha.end)}
            </p>
            {dashaContent && <p>{dashaContent.definition}</p>}
          </div>
          {dashaContent && (
            <div className="card">
              <div className="label">About your {chart.current_mahadasha.lord} period</div>
              <KnowledgeDetail entry={dashaContent} />
            </div>
          )}

          <div className="card">
            <div className="label">Sidereal planets</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
              {chart.planets.map((p) => (
                <li key={p.name}>
                  {p.name} in {p.sign}
                  {p.retrograde ? " (retrograde)" : ""}
                </li>
              ))}
            </ul>
          </div>

          {chart.yogas.length > 0 && (
            <div className="card">
              <div className="label">Yogas</div>
              <p style={{ marginBottom: 12 }}>
                Planetary combinations detected in your chart — a first, deliberately small set,
                not an exhaustive list of every yoga in the tradition.
              </p>
              {chart.yogas.map((yoga) => {
                const yogaContent = content[yoga.yoga_type];
                return (
                  <div key={yoga.yoga_type} style={{ marginBottom: 12 }}>
                    <h3 style={{ marginBottom: 4 }}>{yoga.yoga_type}</h3>
                    <p style={{ margin: 0, color: "var(--text-dim)", fontSize: 14 }}>
                      {yoga.planets.join(" + ")}
                    </p>
                    {yogaContent && <p style={{ marginTop: 8 }}>{yogaContent.definition}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {chart.yogas.map((yoga) => {
            const yogaContent = content[yoga.yoga_type];
            return yogaContent ? (
              <div className="card" key={`${yoga.yoga_type}-detail`}>
                <div className="label">About {yoga.yoga_type}</div>
                <KnowledgeDetail entry={yogaContent} />
              </div>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
