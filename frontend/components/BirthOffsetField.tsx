"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { postBirthTimezone } from "@/lib/api";
import { type BirthOffset, deriveOffsetView, planOffset, type ResolveState } from "@/lib/birth-offset";

type Props = {
  latitude: number | null;
  longitude: number | null;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" or ""
  /** Offset already stored on an existing profile, so a change can be explained. */
  savedHours?: number | null;
  /** Receives the derived offset whenever it changes. May be an inline function. */
  onChange: (offset: BirthOffset) => void;
  label?: string;
};

// Render free-tier cold starts take ~35s, so allow for one before giving up.
const LOOKUP_TIMEOUT_MS = 60_000;

const smallBtn = { padding: "7px 14px", fontSize: 13 } as const;

/**
 * Replaces the old manual "UTC offset" box. The offset is worked out by the backend from
 * birth city + date + local time using historical timezone rules (including daylight
 * saving), and shown to the user in words. There is no silent default: until the offset
 * is known the parent form stays un-submittable. A manual override exists only for the
 * cases the lookup cannot answer (unknown place, service unreachable, a clock time that
 * never happened) or when the user knows better.
 */
export default function BirthOffsetField({
  latitude,
  longitude,
  date,
  time,
  savedHours = null,
  onChange,
  label = "Time zone at birth",
}: Props) {
  const plan = useMemo(() => planOffset({ latitude, longitude, date, time }), [latitude, longitude, date, time]);
  const planKey = JSON.stringify(plan);
  const lookupKey = plan.kind === "resolve" ? planKey : null;

  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; state: ResolveState } | null>(null);
  // Anything the user chose is tied to the inputs it was chosen for, so changing the
  // place/date/time automatically drops a stale override or ambiguity pick.
  const [manual, setManual] = useState<{ key: string; text: string } | null>(null);
  const [pick, setPick] = useState<{ key: string; hours: number } | null>(null);

  useEffect(() => {
    if (plan.kind !== "resolve" || lookupKey === null) return;
    const controller = new AbortController();
    let timedOut = false;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      // A cold or unreachable backend must not leave the user on a spinner forever: after this
      // long the lookup counts as failed and the manual path opens.
      giveUp = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, LOOKUP_TIMEOUT_MS);
      postBirthTimezone(plan.request, controller.signal)
        .then((data) => setSettled({ key: lookupKey, state: { status: "done", data } }))
        .catch(() => {
          // An abort from cleanup (inputs changed / unmounted) is not a failure; our own timeout is.
          if (!controller.signal.aborted || timedOut) setSettled({ key: lookupKey, state: { status: "failed" } });
        })
        .finally(() => clearTimeout(giveUp));
    }, 250); // wait for typing to settle before asking
    return () => {
      clearTimeout(timer);
      clearTimeout(giveUp);
      controller.abort();
    };
  }, [plan, lookupKey, attempt]);

  const resolved: ResolveState | null =
    lookupKey === null ? null : settled?.key === lookupKey ? settled.state : { status: "loading" };
  const manualText = manual?.key === planKey ? manual.text : null;

  const view = deriveOffsetView({
    plan,
    resolved,
    manualText,
    pickedHours: pick?.key === planKey ? pick.hours : null,
    savedHours,
  });

  // Keep the latest callback in a ref and depend only on the VALUES: an inline arrow from the parent
  // changes identity every render, and depending on it would re-fire this effect in a loop.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const { hours: offsetHours, ready: offsetReady } = view.offset;
  useEffect(() => {
    onChangeRef.current({ hours: offsetHours, ready: offsetReady });
  }, [offsetHours, offsetReady]);

  const resolvedHours =
    resolved?.status === "done" && resolved.data.status === "ok" ? resolved.data.utc_offset_hours : null;

  return (
    <div className="field">
      <label>{label}</label>
      <p
        className="sub"
        role="status"
        aria-live="polite"
        style={{ margin: "0 0 8px", textAlign: "left", color: view.tone === "error" ? "#c96a4a" : undefined }}
      >
        {view.message}
      </p>

      {view.choices.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {view.choices.map((c) => (
            <button
              key={c.hours}
              type="button"
              className="btn btn-ghost"
              style={{ ...smallBtn, borderColor: view.offset.hours === c.hours ? "var(--gold)" : undefined }}
              onClick={() => setPick({ key: planKey, hours: c.hours })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {view.showManual && (
        <input
          type="number"
          step="0.25"
          min={-12}
          max={14}
          placeholder="UTC offset in hours, e.g. 5 or -3.5"
          aria-label="UTC offset at birth, in hours"
          value={manual?.key === planKey ? manual.text : ""}
          onChange={(e) => setManual({ key: planKey, text: e.target.value })}
        />
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: view.showManual ? 8 : 0 }}>
        {view.canOverride && manualText === null && (
          <button
            type="button"
            className="btn btn-ghost"
            style={smallBtn}
            onClick={() => setManual({ key: planKey, text: resolvedHours !== null ? String(resolvedHours) : "" })}
          >
            Set it myself
          </button>
        )}
        {manualText !== null && !view.manualRequired && (
          <button type="button" className="btn btn-ghost" style={smallBtn} onClick={() => setManual(null)}>
            Use the automatic value
          </button>
        )}
        {view.canRetry && (
          <button
            type="button"
            className="btn btn-ghost"
            style={smallBtn}
            onClick={() => {
              setSettled(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
