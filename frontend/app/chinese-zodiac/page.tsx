"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChineseZodiacProfile } from "@/lib/api";
import { postChineseZodiac } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function ChineseZodiacPage() {
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [profile, setProfile] = useState<ChineseZodiacProfile | null>(null);
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
        .select("birth_date")
        .eq("id", session.user.id)
        .maybeSingle<{ birth_date: string | null }>();
      if (cancelled) return;
      if (!data?.birth_date) {
        setHasProfile(false);
        setLoading(false);
        return;
      }
      setHasProfile(true);
      try {
        const birthYear = new Date(data.birth_date).getUTCFullYear();
        const result = await postChineseZodiac(birthYear, session.access_token);
        if (!cancelled) setProfile(result);
      } catch {
        if (!cancelled) setError("Couldn't compute your Chinese zodiac — is the backend running? Try again in a moment.");
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
      <section className="screen active" id="chinese-zodiac">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Chinese zodiac</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              This reading is built from your birth year — create your profile to see it.
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
    <section className="screen active" id="chinese-zodiac">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Animal · Element · Yin/Yang
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Chinese zodiac</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Your birth-year sign in the twelve-animal cycle, combined with its ruling element and
        polarity for that sixty-year cycle.
      </p>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {profile && (
        <div className="card">
          <div className="stat-row">
            <div className="stat">
              <div className="val">{profile.animal}</div>
              <div className="lbl">Animal</div>
            </div>
            <div className="stat">
              <div className="val">{profile.element}</div>
              <div className="lbl">Element</div>
            </div>
            <div className="stat">
              <div className="val">{profile.yin_yang}</div>
              <div className="lbl">Polarity</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
