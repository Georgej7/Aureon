"use client";

import { useEffect, useState } from "react";
import type { VoidOfCoursePeriod } from "@/lib/api";
import { ApiError, postVoidOfCourse } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

export default function VoidOfCoursePage() {
  const [startDate, setStartDate] = useState(todayIso());
  const [days, setDays] = useState(14);
  const [periods, setPeriods] = useState<VoidOfCoursePeriod[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Matches the backend's ge=1 validation -- clearing the field to
    // retype a new value gives Number("") = 0 for a moment, which would
    // otherwise fire a request guaranteed to 400.
    if (!Number.isInteger(days) || days < 1) return;

    let cancelled = false;
    // Debounced -- this endpoint is rate-limited to 10/minute, and `days`
    // is a plain controlled number input, so every keystroke while
    // editing it (e.g. clearing "14" and retyping "30") used to fire its
    // own request. A few such edits could burn the whole per-minute
    // budget before the user even finishes typing.
    const timer = setTimeout(() => {
      async function load() {
        setLoading(true);
        setError(null);
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            if (!cancelled) {
              setError("Sign in to view void-of-course periods.");
              setLoading(false);
            }
            return;
          }
          const result = await postVoidOfCourse(startDate, days, session.access_token);
          if (!cancelled) setPeriods(result.periods);
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof ApiError && err.status === 429
                ? "This is rate-limited (10/minute) — you're changing the range a bit fast. Wait about a minute and try again."
                : "Couldn't load void-of-course periods — is the backend running? Try again in a moment."
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [startDate, days]);

  return (
    <section className="screen active" id="void-of-course">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Reference tool
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Void-of-course Moon</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        The Moon is &quot;void of course&quot; from its last major aspect (conjunction, sextile,
        square, trine, or opposition) until it changes sign — traditionally considered a poor
        window for starting anything new, since actions begun then tend to fizzle or go nowhere.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row2">
          <div className="field">
            <label htmlFor="voc-start">Starting from</label>
            <input
              id="voc-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="voc-days">Days</label>
            <input
              id="voc-days"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {!loading && periods && (
        <div className="card">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {periods.map((p, i) => (
              <li
                key={i}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 0", borderBottom: i < periods.length - 1 ? "1px solid var(--line)" : "none",
                  flexWrap: "wrap", gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {formatDateTime(p.start)} → {formatDateTime(p.end)}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  Moon leaves {p.leaving_sign}
                  {p.entering_sign ? ` for ${p.entering_sign}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
