"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { BaguaZone, Compass, KnowledgeEntry, KuaProfile } from "@/lib/api";
import { postBagua, postKua } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const DIRECTION_LABELS: { key: keyof KuaProfile; label: string; meaning: string }[] = [
  { key: "sheng_chi", label: "Sheng Chi", meaning: "Success & prosperity" },
  { key: "tien_yi", label: "Tien Yi", meaning: "Health" },
  { key: "nien_yen", label: "Nien Yen", meaning: "Relationships & harmony" },
  { key: "fu_wei", label: "Fu Wei", meaning: "Personal growth & stability" },
];

// KuaProfile spells directions out in full ("Southeast"); Bagua zones use
// the compass abbreviation ("SE") — this bridges the two so zones can be
// checked against a person's personal Kua directions.
const FULL_TO_ABBR: Record<string, Compass> = {
  North: "N", Northeast: "NE", East: "E", Southeast: "SE",
  South: "S", Southwest: "SW", West: "W", Northwest: "NW",
};

const COMPASS_OPTIONS: { value: Compass; label: string }[] = [
  { value: "N", label: "North" },
  { value: "NE", label: "Northeast" },
  { value: "E", label: "East" },
  { value: "SE", label: "Southeast" },
  { value: "S", label: "South" },
  { value: "SW", label: "Southwest" },
  { value: "W", label: "West" },
  { value: "NW", label: "Northwest" },
];

const GRID_ORDER = [
  "top_left", "top_center", "top_right",
  "middle_left", "center", "middle_right",
  "bottom_left", "bottom_center", "bottom_right",
];

export default function FengShuiPage() {
  const [tier, setTier] = useState<"free" | "premium" | "vip" | undefined>(undefined);

  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<KuaProfile | null>(null);
  const [content, setContent] = useState<KnowledgeEntry | null>(null);

  const [facingDirection, setFacingDirection] = useState<Compass>("N");
  const [baguaSubmitting, setBaguaSubmitting] = useState(false);
  const [baguaError, setBaguaError] = useState<string | null>(null);
  const [zones, setZones] = useState<BaguaZone[] | null>(null);
  const [zoneContent, setZoneContent] = useState<Record<string, KnowledgeEntry>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadTier() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setTier("free");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled) setTier((data?.subscription_tier as "free" | "premium" | "vip") ?? "free");
    }
    loadTier();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = /^\d{4}$/.test(birthYear.trim());
  const personalDirections = profile
    ? new Set(DIRECTION_LABELS.map(({ key }) => FULL_TO_ABBR[profile[key] as string]))
    : new Set<Compass>();

  async function handleCalculate() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setProfile(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("You need to be signed in to calculate your Kua number.");
        setSubmitting(false);
        return;
      }

      const result = await postKua({ birth_year: Number(birthYear), gender }, session.access_token);
      setProfile(result);

      const { data: entry } = await supabase
        .from("knowledge_base")
        .select(
          "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes"
        )
        .eq("topic", `Kua ${result.kua_number}`)
        .maybeSingle();
      setContent((entry as KnowledgeEntry) ?? null);
    } catch {
      setError("Couldn't calculate your Kua number — is the backend running? Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMapRoom() {
    if (baguaSubmitting) return;
    setBaguaSubmitting(true);
    setBaguaError(null);
    setZones(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setBaguaError("You need to be signed in to map a room.");
        setBaguaSubmitting(false);
        return;
      }

      const result = await postBagua({ facing_direction: facingDirection }, session.access_token);
      setZones(result.zones);

      const topics = result.zones.map((z) => z.zone);
      const { data: entries } = await supabase
        .from("knowledge_base")
        .select(
          "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes"
        )
        .in("topic", topics);
      const byTopic: Record<string, KnowledgeEntry> = {};
      for (const entry of (entries as KnowledgeEntry[]) ?? []) byTopic[entry.topic] = entry;
      setZoneContent(byTopic);
    } catch {
      setBaguaError("Couldn't map your room — is the backend running? Try again in a moment.");
    } finally {
      setBaguaSubmitting(false);
    }
  }

  const zonesByPosition: Record<string, BaguaZone> = {};
  if (zones) for (const z of zones) zonesByPosition[z.position] = z;

  return (
    <section className="screen active" id="feng-shui">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Personal feng shui
      </p>
      <h2 style={{ margin: "0 0 24px" }}>Your Kua number</h2>

      <div className="card" style={{ maxWidth: 420 }}>
        <div className="field">
          <label>Birth year</label>
          <input
            type="number"
            placeholder="1993"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </div>
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}
        <button
          className="btn btn-gold"
          style={{ width: "100%", opacity: !canSubmit || submitting ? 0.6 : 1 }}
          onClick={handleCalculate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "Calculating…" : "Calculate"}
        </button>
      </div>

      {profile && (
        <div className="dash-grid" style={{ marginTop: 24 }}>
          <div>
            <div className="card">
              <div className="label">Your Kua number</div>
              <h3>
                {profile.kua_number} <span style={{ fontSize: 14, color: "var(--text-dim)" }}>· {profile.group} group · {profile.element}</span>
              </h3>
              {content && <p>{content.definition}</p>}
            </div>
            {content && (
              <div className="card">
                <div className="label">What this means</div>
                <KnowledgeDetail entry={content} />
              </div>
            )}
          </div>
          <div>
            <div className="card">
              <div className="label">Your directions</div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                {DIRECTION_LABELS.map(({ key, label, meaning }) => (
                  <li
                    key={key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "var(--text-dim)" }}>
                      {label} — {meaning}
                    </span>
                    <strong style={{ color: "var(--text)" }}>{profile[key]}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <p className="eyebrow" style={{ margin: "48px 0 8px" }}>
        VIP feature
      </p>
      <h2 style={{ margin: "0 0 24px" }}>Room feng shui — Bagua mapping</h2>

      {tier === undefined ? null : tier !== "vip" ? (
        <div className="onboard-wrap" style={{ margin: 0 }}>
          <div className="onboard-card hud">
            <span className="hud-tag">VIP feature</span>
            <h2>Map any room in your home</h2>
            <p className="sub">
              See which zone of a room governs wealth, relationships, career, and more — based on
              where your entrance is — cross-referenced with your own personal Kua directions
              above. Part of Aureon VIP.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to VIP
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ maxWidth: 420 }}>
            <div className="field">
              <label>Which direction do you face when you walk in through the entrance?</label>
              <select
                value={facingDirection}
                onChange={(e) => setFacingDirection(e.target.value as Compass)}
              >
                {COMPASS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {baguaError && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 10px" }}>{baguaError}</p>}
            <button
              className="btn btn-gold"
              style={{ width: "100%", opacity: baguaSubmitting ? 0.6 : 1 }}
              onClick={handleMapRoom}
              disabled={baguaSubmitting}
            >
              {baguaSubmitting ? "Mapping…" : "Map this room"}
            </button>
          </div>

          {zones && (
            <>
              {!profile && (
                <p className="sub" style={{ marginTop: 16 }}>
                  Calculate your Kua number above too, and matching zones below will be highlighted.
                </p>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginTop: 24,
                  maxWidth: 640,
                }}
              >
                {GRID_ORDER.map((position) => {
                  const z = zonesByPosition[position];
                  const isMatch = z?.direction && personalDirections.has(z.direction);
                  return (
                    <div
                      key={position}
                      className="card"
                      style={{
                        margin: 0,
                        borderColor: isMatch ? "var(--gold)" : undefined,
                        textAlign: "center",
                      }}
                    >
                      <div className="label">{z?.direction ?? "—"}</div>
                      <h3 style={{ fontSize: 15, margin: "4px 0" }}>{z?.zone}</h3>
                      <p style={{ fontSize: 12, margin: 0 }}>{z?.element}</p>
                      {isMatch && (
                        <p style={{ fontSize: 11, color: "var(--gold)", margin: "6px 0 0" }}>
                          ✦ Your personal direction
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 24 }}>
                {zones.map((z) => {
                  const zc = zoneContent[z.zone];
                  if (!zc) return null;
                  return (
                    <div className="card" key={z.zone}>
                      <div className="label">
                        {z.zone}
                        {z.direction && ` · ${z.direction}`}
                      </div>
                      <KnowledgeDetail entry={zc} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
