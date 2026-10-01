import type { TimezoneResult } from "@/lib/api";

/**
 * Decision logic for the birth-time UTC offset field. Pure on purpose, so every
 * branch is unit-tested without a browser.
 *
 * The offset is NOT something a person can be expected to know (daylight saving
 * rules changed repeatedly: Tbilisi was UTC+5 in May 1999, not +4), so it is derived
 * by the backend from birthplace + date + local time. This module decides what the
 * form shows and whether the form may be submitted. There is deliberately no silent
 * default: `hours` stays null (and `ready` false) until the offset is actually known.
 */

export type BirthOffset = { hours: number | null; ready: boolean };
export const EMPTY_BIRTH_OFFSET: BirthOffset = { hours: null, ready: false };

export type OffsetInputs = {
  latitude: number | null;
  longitude: number | null;
  date: string; // "YYYY-MM-DD" or ""
  time: string; // "HH:MM" or ""
};

export type OffsetPlan =
  | { kind: "waiting" }
  | { kind: "no-place-no-time" }
  | { kind: "needs-place-or-manual" }
  | { kind: "resolve"; request: { latitude: number; longitude: number; date: string; time: string | null } };

export function planOffset(i: OffsetInputs): OffsetPlan {
  if (!i.date) return { kind: "waiting" };
  const hasTime = i.time.trim() !== "";
  if (i.latitude === null || i.longitude === null) {
    return hasTime ? { kind: "needs-place-or-manual" } : { kind: "no-place-no-time" };
  }
  return {
    kind: "resolve",
    request: { latitude: i.latitude, longitude: i.longitude, date: i.date, time: hasTime ? i.time : null },
  };
}

/** "UTC+5", "UTC+5:30", "UTC-3:30" */
export function formatOffset(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `UTC${hours < 0 ? "-" : "+"}${hh}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
}

/** Real-world offsets span UTC-12 to UTC+14. */
export function parseManualOffset(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= -12 && n <= 14 ? n : null;
}

export type ResolveState = { status: "loading" } | { status: "failed" } | { status: "done"; data: TimezoneResult };

export type OffsetView = {
  offset: BirthOffset;
  message: string;
  tone: "info" | "ok" | "error";
  showManual: boolean; // the numeric input is visible
  manualRequired: boolean; // ...and the form cannot proceed without it
  canOverride: boolean; // offer "Set it myself" next to a resolved value
  canRetry: boolean;
  choices: { hours: number; label: string }[]; // ambiguous clock time: user must pick
};

const NONE: OffsetView = {
  offset: EMPTY_BIRTH_OFFSET,
  message: "",
  tone: "info",
  showManual: false,
  manualRequired: false,
  canOverride: false,
  canRetry: false,
  choices: [],
};

export type ViewInputs = {
  plan: OffsetPlan;
  resolved: ResolveState | null; // null when the plan needs no lookup
  manualText: string | null; // null = automatic mode; a string = user chose to set it themselves
  pickedHours: number | null; // choice for an ambiguous clock time
  savedHours: number | null; // offset stored on an existing profile, if any
};

export function deriveOffsetView(v: ViewInputs): OffsetView {
  const manual = v.manualText === null ? null : parseManualOffset(v.manualText);
  const manualMode = v.manualText !== null;

  switch (v.plan.kind) {
    case "waiting":
      return { ...NONE, message: "Enter your birth date and pick your birth city, and Aureon will work out the time zone for you." };

    case "no-place-no-time":
      // Explicit and explained, not a silent default: with neither a place nor a time there are no houses
      // or Rising sign, and the planets are calculated for 12:00 UTC.
      return {
        ...NONE,
        offset: { hours: 0, ready: true },
        message: "No birth city or time given, so your planets are calculated for 12:00 UTC (no Rising sign or houses).",
      };

    case "needs-place-or-manual":
      return {
        ...NONE,
        offset: manual === null ? EMPTY_BIRTH_OFFSET : { hours: manual, ready: true },
        message: "Pick your birth city so Aureon can work out the time zone, or enter the UTC offset at birth yourself.",
        tone: manual === null ? "error" : "info",
        showManual: true,
        manualRequired: true,
      };
  }

  // plan.kind === "resolve"
  const r = v.resolved;
  if (!r || r.status === "loading") {
    return { ...NONE, message: "Working out the time zone…" };
  }
  if (r.status === "failed" || r.data.status === "unknown_zone") {
    return {
      ...NONE,
      offset: manual === null ? EMPTY_BIRTH_OFFSET : { hours: manual, ready: true },
      message:
        r.status === "failed"
          ? "Couldn't reach the time-zone service. Try again, or enter the UTC offset at birth yourself."
          : "Couldn't work out the time zone for that place. Enter the UTC offset at birth yourself.",
      tone: "error",
      showManual: true,
      manualRequired: true,
      canRetry: r.status === "failed",
    };
  }

  const d = r.data;
  const zone = d.tz_name ?? "that place";

  if (manualMode) {
    const auto = d.status === "ok" && d.utc_offset_hours !== null ? ` (automatic: ${formatOffset(d.utc_offset_hours)})` : "";
    return {
      ...NONE,
      offset: manual === null ? EMPTY_BIRTH_OFFSET : { hours: manual, ready: true },
      message: manual === null ? "Enter a UTC offset between -12 and +14." : `Using your own offset, ${formatOffset(manual)}${auto}.`,
      tone: manual === null ? "error" : "info",
      showManual: true,
      manualRequired: false,
    };
  }

  if (d.status === "nonexistent") {
    return {
      ...NONE,
      message: `That local time didn't exist in ${zone} on that date (clocks skipped forward). Check the date and time, or set the offset yourself.`,
      tone: "error",
      canOverride: true,
    };
  }

  if (d.status === "ambiguous") {
    const choices = d.offsets.map((o) => ({
      hours: o.utc_offset_hours,
      label: `${o.label}${o.is_dst ? " (daylight saving time)" : " (standard time)"}`,
    }));
    const picked = choices.find((c) => c.hours === v.pickedHours);
    return {
      ...NONE,
      offset: picked ? { hours: picked.hours, ready: true } : EMPTY_BIRTH_OFFSET,
      message: picked
        ? `${zone}: ${picked.label}.`
        : `Clocks went back that night, so that time happened twice in ${zone}. Which one was it?`,
      tone: picked ? "ok" : "error",
      canOverride: true,
      choices,
    };
  }

  // ok
  const hours = d.utc_offset_hours as number;
  const dst = d.offsets[0]?.is_dst ? ", daylight saving time in effect" : "";
  const noon = d.time_assumed ? " Calculated for 12:00 since no birth time was given." : "";
  const changed =
    v.savedHours !== null && Math.abs(v.savedHours - hours) > 0.01
      ? ` Your saved profile used ${formatOffset(v.savedHours)}; saving will recalculate your chart.`
      : "";
  return {
    ...NONE,
    offset: { hours, ready: true },
    message: `${formatOffset(hours)} (${zone}${dst}), worked out from your birth city and date.${noon}${changed}`,
    tone: "ok",
    canOverride: true,
  };
}
