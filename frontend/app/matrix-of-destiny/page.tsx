"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { KnowledgeEntry, MatrixOfDestinyResponse, MatrixPoint } from "@/lib/api";
import { postMatrixOfDestiny } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const KNOWLEDGE_COLUMNS =
  "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes";

const POINT_LABELS: { key: keyof MatrixOfDestinyResponse; label: string; blurb: string }[] = [
  { key: "day", label: "Day Arcanum", blurb: "How you naturally show up day to day." },
  { key: "month", label: "Month Arcanum", blurb: "The emotional/family current you were born into." },
  { key: "year", label: "Year Arcanum", blurb: "The wider generational theme you carry." },
  { key: "life_purpose", label: "Life Purpose Arcanum", blurb: "The combined thread running through all three." },
];

function PointCard({
  title,
  blurb,
  point,
  entry,
}: {
  title: string;
  blurb: string;
  point: MatrixPoint;
  entry: KnowledgeEntry | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <div className="label">{title}</div>
          <h3 style={{ margin: "0 0 4px" }}>
            {point.number} · {point.arcana}
          </h3>
          <p className="sub" style={{ margin: 0 }}>{blurb}</p>
        </div>
        <span style={{ color: "var(--gold-soft)", fontSize: 20 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 16 }}>
          {entry ? (
            <KnowledgeDetail entry={entry} />
          ) : (
            <p className="sub">No written interpretation on file for this arcanum yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatrixOfDestinyPage() {
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [matrix, setMatrix] = useState<MatrixOfDestinyResponse | null>(null);
  const [knowledge, setKnowledge] = useState<Record<string, KnowledgeEntry>>({});
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
        const result = await postMatrixOfDestiny(data.birth_date, session.access_token);
        if (!cancelled) setMatrix(result);
        // Matrix of Destiny explicitly borrows Tarot's 22 Major Arcana
        // numbering/meanings (see backend/app/calc/matrix_of_destiny.py) --
        // reusing the same already-verified tarot knowledge_base content
        // rather than authoring separate entries for the same 22 archetypes.
        const arcanaNames = Array.from(new Set(Object.values(result).map((p) => p.arcana)));
        const { data: entries } = await supabase
          .from("knowledge_base")
          .select(KNOWLEDGE_COLUMNS)
          .eq("system", "tarot")
          .in("topic", arcanaNames);
        if (!cancelled) {
          const byTopic: Record<string, KnowledgeEntry> = {};
          for (const entry of (entries as KnowledgeEntry[]) ?? []) byTopic[entry.topic] = entry;
          setKnowledge(byTopic);
        }
      } catch {
        if (!cancelled) setError("Couldn't compute your Matrix of Destiny — is the backend running? Try again in a moment.");
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
      <section className="screen active" id="matrix-of-destiny">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Matrix of Destiny</span>
            <h2>Complete your profile first</h2>
            <p className="sub">This is built from your birth date — create your profile to see it.</p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="matrix-of-destiny">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Numerology · Major Arcana
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Matrix of Destiny</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        A modern numerology system, not an ancient or astronomically-verifiable one — it maps
        your birth date onto 22 archetypal numbers borrowed directly from Tarot&apos;s Major
        Arcana. This shows the core calculation: your Day, Month, and Year arcana, and the
        combined Life Purpose arcana. Some schools of this tradition compute a fuller expanded
        matrix (money, talents, relationships, and more) — those derived points&apos; formulas
        genuinely vary between practitioners, so this stays to the part that&apos;s consistent
        across sources rather than presenting one school&apos;s specific convention as settled.
      </p>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {matrix &&
        POINT_LABELS.map(({ key, label, blurb }) => (
          <PointCard key={key} title={label} blurb={blurb} point={matrix[key]} entry={knowledge[matrix[key].arcana]} />
        ))}
    </section>
  );
}
