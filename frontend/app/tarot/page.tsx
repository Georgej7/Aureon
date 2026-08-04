"use client";

import { useState } from "react";
import type { TarotCard } from "@/lib/api";
import { postTarotDraw } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function TarotPage() {
  const [card, setCard] = useState<TarotCard | null>(null);
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
    </section>
  );
}
