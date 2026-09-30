import { consent } from "@/lib/consent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// GA4 stays completely dormant (no script, no dataLayer, no banner, every
// function below a no-op) until NEXT_PUBLIC_GA_MEASUREMENT_ID is set at build
// time, and even then does nothing until the visitor has affirmatively
// accepted analytics (lib/consent.ts).
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The only path shape GA4 ever sees: no query string, no fragment, and no
 * record identifiers. /clients/<id> is a practitioner's client record and
 * must never reach GA4, so any segment after "clients" (and any bare UUID
 * anywhere) collapses to ":id". Query strings are dropped wholesale rather
 * than filtered, so a future param can't leak by accident.
 */
export function sanitizePath(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0] || "/";
  const segments = clean.split("/");
  return segments
    .map((seg, i) => (seg && (segments[i - 1] === "clients" || UUID.test(seg)) ? ":id" : seg))
    .join("/");
}

/** origin + sanitized path, or "" if the URL can't be parsed. */
export function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${sanitizePath(u.pathname)}`;
  } catch {
    return "";
  }
}

const disableFlag = () => `ga-disable-${GA_MEASUREMENT_ID}`;

/** True only when GA4 is configured, the visitor accepted, and it hasn't been switched off. */
function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return false;
  if ((window as unknown as Record<string, unknown>)[disableFlag()] === true) return false;
  return consent.read() === "granted";
}

// gtag.js honours window["ga-disable-<ID>"]: while true it collects nothing.
function setDisabled(disabled: boolean) {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, unknown>)[disableFlag()] = disabled;
}

// Expires GA4's cookies (_ga, _ga_<ID>) on this host and every parent domain.
function clearAnalyticsCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0].trim())
    .filter((n) => n === "_ga" || n.startsWith("_ga_"));
  if (names.length === 0) return;
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => `; domain=${i === 0 ? "" : "."}${parts.slice(i).join(".")}`)];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

/** Called when consent is granted (or restored from storage): lets gtag collect. */
export function enableAnalytics() {
  setDisabled(false);
}

/** Called when consent is absent or withdrawn: stops collection and removes GA cookies. */
export function disableAnalytics() {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  setDisabled(true);
  clearAnalyticsCookies();
}

// Sets the sanitized page context on every subsequent event. gtag otherwise
// attaches the full document.location (query string, fragment, client id) to
// every event, including the automatic enhanced-measurement ones.
function setPageContext(pathname: string) {
  const path = sanitizePath(pathname);
  window.gtag?.("set", {
    page_location: `${window.location.origin}${path}`,
    page_path: path,
    page_referrer: sanitizeUrl(document.referrer),
  });
}

// Creates the dataLayer/gtag queue and configures the property exactly once,
// before anything else can push an event, so call order can't lose the first
// page_view or a mount-time event (gtag.js replays the queue when it loads).
// Returns false, and touches nothing, unless analytics is allowed right now.
function ensureGtag(): boolean {
  if (!analyticsAllowed()) return false;
  if (typeof window.gtag !== "function") {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // gtag.js requires the `arguments` object itself, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false, // page_view is sent once per route below
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    setPageContext(window.location.pathname);
  }
  return true;
}

// Safe to call unconditionally anywhere in the app: a no-op without consent
// (the event is dropped, not queued). Never pass user-entered text, names,
// birth data or ids in params.
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!ensureGtag()) return;
  window.gtag!("event", name, params);
}

/** One page_view per route change (see components/Analytics.tsx). */
export function trackPageView(pathname: string) {
  if (!ensureGtag()) return;
  setPageContext(pathname);
  window.gtag!("event", "page_view");
}
