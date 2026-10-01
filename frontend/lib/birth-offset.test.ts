import { describe, expect, it } from "vitest";
import type { TimezoneResult } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import {
  deriveOffsetView,
  EMPTY_BIRTH_OFFSET,
  formatOffset,
  parseManualOffset,
  planOffset,
  type ViewInputs,
} from "@/lib/birth-offset";

const TBILISI = { latitude: 41.6934591, longitude: 44.8014495 };

const ok = (hours: number, dst: boolean, tz = "Asia/Tbilisi", assumed = false): TimezoneResult => ({
  status: "ok",
  tz_name: tz,
  utc_offset_hours: hours,
  offsets: [{ utc_offset_hours: hours, is_dst: dst, abbreviation: null, label: formatOffset(hours) }],
  time_assumed: assumed,
});

const view = (over: Partial<ViewInputs> & Pick<ViewInputs, "plan">) =>
  deriveOffsetView({ resolved: null, manualText: null, pickedHours: null, savedHours: null, ...over });

describe("planOffset: what the form must do for each combination of inputs", () => {
  it("waits for a date", () => {
    expect(planOffset({ ...TBILISI, date: "", time: "23:30" }).kind).toBe("waiting");
  });
  it("asks the backend when there is a place and a date, with and without a time", () => {
    expect(planOffset({ ...TBILISI, date: "1999-05-07", time: "23:30" })).toEqual({
      kind: "resolve",
      request: { ...TBILISI, date: "1999-05-07", time: "23:30" },
    });
    const noTime = planOffset({ ...TBILISI, date: "1999-05-07", time: "  " });
    expect(noTime.kind === "resolve" && noTime.request.time).toBeNull();
  });
  it("without a place: explicit planets-only when there is also no time; otherwise the user must supply the offset", () => {
    expect(planOffset({ latitude: null, longitude: null, date: "1999-05-07", time: "" }).kind).toBe("no-place-no-time");
    expect(planOffset({ latitude: null, longitude: null, date: "1999-05-07", time: "23:30" }).kind).toBe(
      "needs-place-or-manual"
    );
  });
});

describe("deriveOffsetView: there is no silent UTC 0, and the form is only ready when the offset is known", () => {
  const resolvePlan = planOffset({ ...TBILISI, date: "1999-05-07", time: "23:30" });

  it("starts not ready (no default of 0) and while loading", () => {
    expect(view({ plan: planOffset({ ...TBILISI, date: "", time: "" }) }).offset).toEqual(EMPTY_BIRTH_OFFSET);
    const loading = view({ plan: resolvePlan, resolved: { status: "loading" } });
    expect(loading.offset).toEqual(EMPTY_BIRTH_OFFSET);
    expect(view({ plan: resolvePlan, resolved: null }).offset.ready).toBe(false);
  });

  it("Tbilisi 7 May 1999 23:30 becomes +5, explained in words, and the user is not asked anything", () => {
    const v = view({ plan: resolvePlan, resolved: { status: "done", data: ok(5, true) } });
    expect(v.offset).toEqual({ hours: 5, ready: true });
    expect(v.message).toContain("UTC+5");
    expect(v.message).toContain("Asia/Tbilisi");
    expect(v.message).toContain("daylight saving time in effect");
    expect(v.showManual).toBe(false);
    expect(v.canOverride).toBe(true);
  });

  it("standard time is not described as daylight saving", () => {
    const v = view({ plan: resolvePlan, resolved: { status: "done", data: ok(4, false) } });
    expect(v.message).toContain("UTC+4");
    expect(v.message).not.toContain("daylight");
  });

  it("explains an unknown birth time was resolved at noon", () => {
    const plan = planOffset({ ...TBILISI, date: "1999-05-07", time: "" });
    const v = view({ plan, resolved: { status: "done", data: ok(5, true, "Asia/Tbilisi", true) } });
    expect(v.message).toContain("12:00");
  });

  it("an existing profile whose saved offset differs is told its chart will be recalculated", () => {
    const v = view({ plan: resolvePlan, resolved: { status: "done", data: ok(5, true) }, savedHours: 0 });
    expect(v.message).toContain("saved profile used UTC+0");
    expect(view({ plan: resolvePlan, resolved: { status: "done", data: ok(5, true) }, savedHours: 5 }).message).not.toContain(
      "saved profile"
    );
  });

  it("a clock time that repeats needs the user's choice and is not ready until they choose", () => {
    const ambiguous: TimezoneResult = {
      status: "ambiguous",
      tz_name: "America/New_York",
      utc_offset_hours: null,
      offsets: [
        { utc_offset_hours: -4, is_dst: true, abbreviation: "EDT", label: "UTC-4" },
        { utc_offset_hours: -5, is_dst: false, abbreviation: "EST", label: "UTC-5" },
      ],
      time_assumed: false,
    };
    const unchosen = view({ plan: resolvePlan, resolved: { status: "done", data: ambiguous } });
    expect(unchosen.offset.ready).toBe(false);
    expect(unchosen.choices.map((c) => c.hours)).toEqual([-4, -5]);
    const chosen = view({ plan: resolvePlan, resolved: { status: "done", data: ambiguous }, pickedHours: -5 });
    expect(chosen.offset).toEqual({ hours: -5, ready: true });
    // a pick that is not one of the offered options is ignored
    expect(view({ plan: resolvePlan, resolved: { status: "done", data: ambiguous }, pickedHours: 3 }).offset.ready).toBe(false);
  });

  it("a clock time that never happened blocks submission and says why", () => {
    const gap: TimezoneResult = { status: "nonexistent", tz_name: "America/New_York", utc_offset_hours: null, offsets: [], time_assumed: false };
    const v = view({ plan: resolvePlan, resolved: { status: "done", data: gap } });
    expect(v.offset.ready).toBe(false);
    expect(v.tone).toBe("error");
    expect(v.message).toContain("didn't exist");
  });

  it("an unknown zone or an unreachable service requires a manual offset and never falls back to 0", () => {
    const unknown: TimezoneResult = { status: "unknown_zone", tz_name: null, utc_offset_hours: null, offsets: [], time_assumed: false };
    for (const resolved of [{ status: "failed" as const }, { status: "done" as const, data: unknown }]) {
      const none = view({ plan: resolvePlan, resolved });
      expect(none.offset).toEqual(EMPTY_BIRTH_OFFSET);
      expect(none.showManual && none.manualRequired).toBe(true);
      expect(view({ plan: resolvePlan, resolved, manualText: "" }).offset.ready).toBe(false);
      expect(view({ plan: resolvePlan, resolved, manualText: "abc" }).offset.ready).toBe(false);
      expect(view({ plan: resolvePlan, resolved, manualText: "3.5" }).offset).toEqual({ hours: 3.5, ready: true });
    }
    expect(view({ plan: resolvePlan, resolved: { status: "failed" } }).canRetry).toBe(true);
  });

  it("a user override replaces the automatic value, shows both, and rejects impossible offsets", () => {
    const resolved = { status: "done" as const, data: ok(5, true) };
    const over = view({ plan: resolvePlan, resolved, manualText: "4" });
    expect(over.offset).toEqual({ hours: 4, ready: true });
    expect(over.message).toContain("UTC+4");
    expect(over.message).toContain("automatic: UTC+5");
    expect(view({ plan: resolvePlan, resolved, manualText: "99" }).offset.ready).toBe(false);
    expect(view({ plan: resolvePlan, resolved, manualText: "" }).offset.ready).toBe(false);
  });

  it("no place and no time: explicit planets-only message, not a hidden default", () => {
    const v = view({ plan: planOffset({ latitude: null, longitude: null, date: "1999-05-07", time: "" }) });
    expect(v.offset).toEqual({ hours: 0, ready: true });
    expect(v.message).toContain("12:00 UTC");
    expect(v.message).toContain("no Rising sign");
  });

  it("a birth time without a birth place cannot proceed until the user picks a city or enters an offset", () => {
    const plan = planOffset({ latitude: null, longitude: null, date: "1999-05-07", time: "23:30" });
    expect(view({ plan }).offset.ready).toBe(false);
    expect(view({ plan, manualText: "5" }).offset).toEqual({ hours: 5, ready: true });
  });
});

describe("formatOffset / parseManualOffset", () => {
  it("formats whole, fractional and negative offsets", () => {
    expect(formatOffset(5)).toBe("UTC+5");
    expect(formatOffset(5.5)).toBe("UTC+5:30");
    expect(formatOffset(5.75)).toBe("UTC+5:45");
    expect(formatOffset(-3.5)).toBe("UTC-3:30");
    expect(formatOffset(0)).toBe("UTC+0");
  });
  it("accepts only real-world offsets", () => {
    expect(parseManualOffset("5")).toBe(5);
    expect(parseManualOffset("-12")).toBe(-12);
    expect(parseManualOffset("14")).toBe(14);
    for (const bad of ["", "  ", "x", "15", "-13", "NaN", "Infinity"]) expect(parseManualOffset(bad)).toBeNull();
  });
});

describe("offsetToIso: the string the backend turns into the UTC instant used for the chart", () => {
  it("formats whole, fractional and negative offsets", () => {
    expect(offsetToIso(5)).toBe("+05:00");
    expect(offsetToIso(0)).toBe("+00:00");
    expect(offsetToIso(5.75)).toBe("+05:45");
    expect(offsetToIso(-3.5)).toBe("-03:30");
    expect(offsetToIso(14)).toBe("+14:00");
    expect(offsetToIso(-12)).toBe("-12:00");
  });
  it("never emits ':60' (the old implementation rounded the minutes separately)", () => {
    expect(offsetToIso(4.9999)).toBe("+05:00");
    expect(offsetToIso(-4.9999)).toBe("-05:00");
    expect(offsetToIso(2.983333)).toBe("+02:59"); // pre-standard local mean time, rounded to the minute
    for (let h = -12; h <= 14; h += 1 / 60) expect(offsetToIso(h)).toMatch(/^[+-]\d{2}:[0-5]\d$/);
  });
  it("the resolved +5 becomes exactly 18:30 UTC for 23:30 local (what actually reaches the calculation)", () => {
    const datetime = `1999-05-07T23:30:00${offsetToIso(5)}`;
    expect(datetime).toBe("1999-05-07T23:30:00+05:00");
    expect(new Date(datetime).toISOString()).toBe("1999-05-07T18:30:00.000Z");
    // and it differs from what the old default (0) and the "corrected" +4 would have produced
    expect(new Date(`1999-05-07T23:30:00${offsetToIso(0)}`).toISOString()).toBe("1999-05-07T23:30:00.000Z");
    expect(new Date(`1999-05-07T23:30:00${offsetToIso(4)}`).toISOString()).toBe("1999-05-07T19:30:00.000Z");
  });
});
