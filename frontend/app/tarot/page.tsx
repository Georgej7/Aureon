"use client";

import { useState } from "react";
import KnowledgeDetail from "@/components/KnowledgeDetail";
import type { KnowledgeEntry, TarotCard } from "@/lib/api";
import { postTarotDraw } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const KNOWLEDGE_COLUMNS =
  "system, category, topic, definition, traditional_interpretation, modern_interpretation, psychological_interpretation, positive_aspects, challenges, career_meaning, relationship_meaning, growth_meaning, sources, confidence_level, context_notes";

export default function TarotPage() {
  const [card, setCard] = useState<TarotCard | null>(null);
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraw() {
    setDrawing(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Sign in to draw a card.");
        return;
      }
      const seed = `${session.user.id}:${Date.now()}`;
      const result = await postTarotDraw(seed, session.access_token);
      setCard(result);
      // The card draw and its written meaning are two separate systems
      // (backend/app/calc/tarot.py just picks a name; the interpretation
      // lives in the knowledge base, same pattern as every other reading in
      // this app) -- this was previously never wired together, so drawing
      // a card showed only its name with no meaning attached at all.
      const { data } = await supabase
        .from("knowledge_base")
        .select(KNOWLEDGE_COLUMNS)
        .eq("system", "tarot")
        .eq("topic", result.name)
        .maybeSingle();
      setEntry((data as KnowledgeEntry) ?? null);
    } catch {
      setError("Couldn't draw a card — is the backend running? Try again in a moment.");
    } finally {
      setDrawing(false);
    }
  }

  return (
    <section className="screen active" id="tarot">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Major Arcana
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Tarot draw</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Pull a single Major Arcana card for reflection — upright or reversed, drawn fresh each
        time.
      </p>

      <div className="card hud" style={{ maxWidth: 420, textAlign: "center" }}>
        {card ? (
          <>
            <h3 style={{ fontSize: 26, margin: "0 0 6px" }}>{card.name}</h3>
            <p className="sub" style={{ marginBottom: 20 }}>
              {card.upright ? "Upright" : "Reversed"}
            </p>
          </>
        ) : (
          <p className="sub" style={{ marginBottom: 20 }}>
            No card drawn yet.
          </p>
        )}
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
        <button
          className="btn btn-gold"
          onClick={handleDraw}
          disabled={drawing}
          style={{ opacity: drawing ? 0.6 : 1 }}
        >
          {drawing ? "Drawing…" : card ? "Draw again" : "Draw a card"}
        </button>
      </div>

      {card && entry && (
        <div className="card" style={{ maxWidth: 640, marginTop: 24 }}>
          {!card.upright && (
            <p className="sub" style={{ marginBottom: 16 }}>
              Reversed generally points to this meaning turned inward, delayed, or blocked —
              read the upright meaning below as the starting point, then consider what&apos;s
              holding it back.
            </p>
          )}
          <p style={{ marginBottom: 16 }}>{entry.definition}</p>
          <KnowledgeDetail entry={entry} />
        </div>
      )}
    </section>
  );
}
