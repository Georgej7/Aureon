import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_KEY } from "@/lib/consent";

// The analytics module reads NEXT_PUBLIC_GA_MEASUREMENT_ID at import time and the
// consent store binds to window.localStorage, so each test builds a fake browser,
// then imports a fresh copy of the modules.
const ID = "G-TESTTEST00";

type FakeWindow = Record<string, unknown> & { localStorage: Storage; gtag?: unknown; dataLayer?: unknown[] };

function fakeBrowser(stored: string | null, cookie = "") {
  const data: Record<string, string> = stored === null ? {} : { [CONSENT_KEY]: stored };
  const cookieWrites: string[] = [];
  const win = {
    localStorage: {
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    },
    location: { origin: "https://askaureon.com", hostname: "www.askaureon.com", pathname: "/" },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as FakeWindow;
  const doc = {
    referrer: "",
    get cookie() {
      return cookie;
    },
    set cookie(v: string) {
      cookieWrites.push(v);
    },
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  return { win, cookieWrites };
}

async function load(id: string | null = ID) {
  vi.resetModules();
  if (id === null) vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
  else vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", id);
  const analytics = await import("@/lib/analytics");
  const { consent } = await import("@/lib/consent");
  return { analytics, consent };
}

const dl = (win: FakeWindow) => (win.dataLayer ?? []).map((e) => Array.from(e as ArrayLike<unknown>));

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analytics is gated on affirmative consent", () => {
  it("pre-consent: nothing is created, queued or configured, however often it is called", async () => {
    const { win } = fakeBrowser(null);
    const { analytics } = await load();
    analytics.trackPageView("/pricing");
    analytics.trackEvent("tool_used", { tool: "tarot_draw" });
    expect(win.gtag).toBeUndefined();
    expect(win.dataLayer).toBeUndefined();
  });

  it("rejected: still nothing, and disabling removes any GA cookies", async () => {
    const { win, cookieWrites } = fakeBrowser("denied", "_ga=GA1.1.1; _ga_TESTTEST00=GS1.1; session=abc");
    const { analytics } = await load();
    analytics.trackPageView("/pricing");
    analytics.trackEvent("pricing_viewed");
    expect(win.gtag).toBeUndefined();
    expect(win.dataLayer).toBeUndefined();

    analytics.disableAnalytics();
    expect(win[`ga-disable-${ID}`]).toBe(true);
    const expired = cookieWrites.filter((w) => w.includes("expires=Thu, 01 Jan 1970"));
    expect(expired.some((w) => w.startsWith("_ga="))).toBe(true);
    expect(expired.some((w) => w.startsWith("_ga_TESTTEST00="))).toBe(true);
    expect(cookieWrites.some((w) => w.startsWith("session="))).toBe(false); // only GA cookies are touched
  });

  it("accepted: configures GA once and sends sanitized page views and events", async () => {
    const { win } = fakeBrowser(null);
    const { analytics, consent } = await load();
    analytics.trackPageView("/pricing"); // before accepting: dropped, not queued
    expect(win.dataLayer).toBeUndefined();

    consent.accept();
    analytics.enableAnalytics();
    analytics.trackPageView("/clients/123e4567-e89b-12d3-a456-426614174000?name=Anna");
    analytics.trackEvent("tool_used", { tool: "tarot_draw" });

    const layer = dl(win);
    expect(layer[0][0]).toBe("js");
    expect(layer[1]).toEqual(["config", ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
    expect(layer.filter((e) => e[0] === "config")).toHaveLength(1);
    expect(layer.filter((e) => e[0] === "event" && e[1] === "page_view")).toHaveLength(1);
    expect(layer.some((e) => e[0] === "event" && e[1] === "tool_used")).toBe(true);
    expect(JSON.stringify(layer)).not.toMatch(/123e4567|Anna|pricing/); // the pre-consent view was never queued
    expect(layer.some((e) => e[0] === "set" && (e[1] as { page_location: string }).page_location === "https://askaureon.com/clients/:id")).toBe(true);
  });

  it("persisted: a returning visitor who accepted earlier is tracked with no new click", async () => {
    const { win } = fakeBrowser("granted");
    const { analytics } = await load();
    analytics.enableAnalytics();
    analytics.trackPageView("/pricing");
    expect(dl(win).some((e) => e[0] === "event" && e[1] === "page_view")).toBe(true);
  });

  it("persisted rejection: a returning visitor who rejected stays untracked", async () => {
    const { win } = fakeBrowser("denied");
    const { analytics } = await load();
    analytics.trackPageView("/pricing");
    expect(win.dataLayer).toBeUndefined();
  });

  it("withdrawal: after revoking, no further events are sent and GA cookies are removed", async () => {
    const { win, cookieWrites } = fakeBrowser("granted", "_ga=GA1.1.1");
    const { analytics, consent } = await load();
    analytics.enableAnalytics();
    analytics.trackPageView("/pricing");
    const before = dl(win).length;

    consent.clear(); // footer "Analytics settings"
    analytics.disableAnalytics();
    analytics.trackPageView("/terms");
    analytics.trackEvent("tool_used", { tool: "x" });
    expect(dl(win)).toHaveLength(before);
    expect(win[`ga-disable-${ID}`]).toBe(true);
    expect(cookieWrites.some((w) => w.startsWith("_ga=") && w.includes("1970"))).toBe(true);
  });

  it("re-accepting after a withdrawal resumes collection", async () => {
    const { win } = fakeBrowser("granted");
    const { analytics, consent } = await load();
    analytics.enableAnalytics();
    analytics.trackPageView("/a");
    consent.clear();
    analytics.disableAnalytics();
    consent.accept();
    analytics.enableAnalytics();
    analytics.trackPageView("/b");
    const views = dl(win).filter((e) => e[0] === "event" && e[1] === "page_view");
    expect(views).toHaveLength(2);
  });

  it("no measurement ID configured: dormant even with consent granted", async () => {
    const { win } = fakeBrowser("granted");
    const { analytics } = await load(null);
    analytics.enableAnalytics();
    analytics.trackPageView("/pricing");
    analytics.trackEvent("x");
    expect(win.gtag).toBeUndefined();
    expect(win.dataLayer).toBeUndefined();
  });
});
