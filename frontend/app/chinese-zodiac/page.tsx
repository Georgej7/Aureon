"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { ChineseZodiacProfile, KnowledgeEntry } from "@/lib/api";
import { postChineseZodiac } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const KNOWLEDGE_COLUMNS =
  "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes";

export default function ChineseZodiacPage() {
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [profile, setProfile] = useState<ChineseZodiacProfile | null>(null);
  const [animalEntry, setAnimalEntry] = useState<KnowledgeEntry | null>(null);
  const [elementEntry, setElementEntry] = useState<KnowledgeEntry | null>(null);
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
        // Content topics for this system are "{Animal}" and "{Element} Year"
        // (distinct from Feng Shui's separate "{Element} Element" set, which
        // is a different content file entirely) -- was never queried at
        // all before, so the page only ever showed the three raw stat
        // words with zero explanation of what any of them meant.
        const { data: entries } = await supabase
          .from("knowledge_base")
          .select(KNOWLEDGE_COLUMNS)
          .in("topic", [result.animal, `${result.element} Year`]);
        if (!cancelled) {
          setAnimalEntry((entries as KnowledgeEntry[])?.find((e) => e.topic === result.animal) ?? null);
          setElementEntry(
            (entries as KnowledgeEntry[])?.find((e) => e.topic === `${result.element} Year`) ?? null
          );
        }
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
        <>
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
          {animalEntry && (
            <div className="card">
              <div className="label">{profile.animal}</div>
              <p style={{ marginBottom: 12 }}>{animalEntry.definition}</p>
              <KnowledgeDetail entry={animalEntry} />
            </div>
          )}
          {elementEntry && (
            <div className="card">
              <div className="label">
                {profile.element} · {profile.yin_yang}
              </div>
              <p style={{ marginBottom: 12 }}>{elementEntry.definition}</p>
              <KnowledgeDetail entry={elementEntry} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
