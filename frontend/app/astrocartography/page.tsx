"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AstrocartographyResponse, PlanetLines, SubscriptionTier } from "@/lib/api";
import { ApiError, postAstrocartography } from "@/lib/api";
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

const PLANET_COLORS: Record<string, string> = {
  Sun: "#c9a24a",
  Moon: "#a89f8f",
  Mercury: "#6f9c8f",
  Venus: "#c96a9a",
  Mars: "#c96a4a",
  Jupiter: "#8a7440",
  Saturn: "#6f5f8c",
  Uranus: "#4a9cc9",
  Neptune: "#4a6ac9",
  Pluto: "#7a2e2e",
};

const DEFAULT_ON = new Set(["Sun", "Moon", "Venus", "Jupiter"]);

const MAP_W = 720;
const MAP_H = 360;

function x(lon: number): number {
  return ((lon + 180) / 360) * MAP_W;
}
function y(lat: number): number {
  return ((90 - lat) / 180) * MAP_H;
}

// Splits a curve into separate segments wherever it wraps across the +/-180
// meridian -- otherwise a wraparound point draws one long line straight
// across the whole map instead of exiting one edge and re-entering the other.
function curveSegments(points: { latitude: number; longitude: number }[]): string[] {
  const segments: string[] = [];
  let current: string[] = [];
  let prevLon: number | null = null;
  for (const p of points) {
    if (prevLon !== null && Math.abs(p.longitude - prevLon) > 180) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
    }
    current.push(`${x(p.longitude).toFixed(1)},${y(p.latitude).toFixed(1)}`);
    prevLon = p.longitude;
  }
  if (current.length > 1) segments.push(current.join(" "));
  return segments;
}

function PlanetOverlay({ line, color }: { line: PlanetLines; color: string }) {
  const ascSegments = useMemo(() => curveSegments(line.asc_curve), [line]);
  const descSegments = useMemo(() => curveSegments(line.desc_curve), [line]);
  return (
    <g>
      <line x1={x(line.mc_longitude)} y1={0} x2={x(line.mc_longitude)} y2={MAP_H} stroke={color} strokeWidth={1.4} opacity={0.85} />
      <line x1={x(line.ic_longitude)} y1={0} x2={x(line.ic_longitude)} y2={MAP_H} stroke={color} strokeWidth={1.4} opacity={0.5} strokeDasharray="4 3" />
      {ascSegments.map((pts, i) => (
        <polyline key={`asc-${i}`} points={pts} fill="none" stroke={color} strokeWidth={1.4} opacity={0.85} />
      ))}
      {descSegments.map((pts, i) => (
        <polyline key={`desc-${i}`} points={pts} fill="none" stroke={color} strokeWidth={1.4} opacity={0.5} strokeDasharray="4 3" />
      ))}
    </g>
  );
}

export default function AstrocartographyPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [data, setData] = useState<AstrocartographyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<string>>(new Set(DEFAULT_ON));

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
      const { data: row } = await supabase
        .from("profiles")
        .select("birth_date, birth_time, latitude, longitude, utc_offset, subscription_tier")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();
      if (cancelled) return;
      const resolvedTier = row?.subscription_tier ?? "free";
      setTier(resolvedTier);
      setHasProfile(!!row?.birth_date);

      if (resolvedTier === "free" || !row?.birth_date) {
        setLoading(false);
        return;
      }

      try {
        const hasTime = !!row.birth_time;
        const hasLocation = row.latitude !== null && row.longitude !== null;
        const datetime = `${row.birth_date}T${hasTime ? row.birth_time : "12:00"}:00${offsetToIso(row.utc_offset ?? 0)}`;
        const result = await postAstrocartography(
          {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: row.latitude!, longitude: row.longitude! } : {}),
          },
          session.access_token
        );
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError && err.status === 429
              ? "You're loading this a bit fast — wait about a minute and try again."
              : "Couldn't compute your astrocartography lines — is the backend running? Try again in a moment."
          );
        }
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
      <section className="screen active" id="astrocartography">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Premium feature</span>
            <h2>AstroCartography</h2>
            <p className="sub">
              See where on Earth each planet was rising, setting, or angular at the moment you
              were born — a real relocation-astrology map. Part of Aureon Premium.
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
      <section className="screen active" id="astrocartography">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">AstroCartography</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              This map is built from your exact birth moment — create your profile to see it.
            </p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  function toggle(planet: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(planet)) next.delete(planet);
      else next.add(planet);
      return next;
    });
  }

  return (
    <section className="screen active" id="astrocartography">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Relocation astrology
      </p>
      <h2 style={{ margin: "0 0 12px" }}>AstroCartography</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Solid lines mark where a planet was rising (left curve) or culminating (vertical, MC)
        at your exact birth instant; dashed lines mark setting (DSC) or anti-culminating (IC).
        Coordinates are exact — this is a coordinate grid, not a detailed political map, so use
        latitude/longitude to place a line relative to where you actually are.
      </p>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {data && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              {data.lines.map((line) => (
                <label
                  key={line.planet}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={visible.has(line.planet)}
                    onChange={() => toggle(line.planet)}
                  />
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: PLANET_COLORS[line.planet],
                    }}
                  />
                  {line.planet}
                </label>
              ))}
            </div>
          </div>

          <div className="card" style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", height: "auto", minWidth: 480 }}>
              <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="var(--bg-raised)" />
              {[-90, -60, -30, 0, 30, 60, 90].map((lat) => (
                <line key={`lat-${lat}`} x1={0} y1={y(lat)} x2={MAP_W} y2={y(lat)} stroke="var(--line)" strokeWidth={lat === 0 ? 1 : 0.5} />
              ))}
              {[-180, -120, -60, 0, 60, 120, 180].map((lon) => (
                <line key={`lon-${lon}`} x1={x(lon)} y1={0} x2={x(lon)} y2={MAP_H} stroke="var(--line)" strokeWidth={lon === 0 ? 1 : 0.5} />
              ))}
              {data.lines
                .filter((line) => visible.has(line.planet))
                .map((line) => (
                  <PlanetOverlay key={line.planet} line={line} color={PLANET_COLORS[line.planet]} />
                ))}
            </svg>
          </div>
          <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>
            Solid = ASC (rising) / MC (culminating) · Dashed = DSC (setting) / IC (anti-culminating)
          </p>
        </>
      )}
    </section>
  );
}
