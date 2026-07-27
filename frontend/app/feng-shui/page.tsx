"use client";

import { useState } from "react";
import type { KnowledgeEntry, KuaProfile } from "@/lib/api";
import { postKua } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const DIRECTION_LABELS: { key: keyof KuaProfile; label: string; meaning: string }[] = [
  { key: "sheng_chi", label: "Sheng Chi", meaning: "Success & prosperity" },
  { key: "tien_yi", label: "Tien Yi", meaning: "Health" },
  { key: "nien_yen", label: "Nien Yen", meaning: "Relationships & harmony" },
  { key: "fu_wei", label: "Fu Wei", meaning: "Personal growth & stability" },
];

export default function FengShuiPage() {
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<KuaProfile | null>(null);
  const [content, setContent] = useState<KnowledgeEntry | null>(null);

  const canSubmit = /^\d{4}$/.test(birthYear.trim());

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
    </section>
  );
}
