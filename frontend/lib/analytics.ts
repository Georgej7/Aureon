declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// No-ops until NEXT_PUBLIC_GA_MEASUREMENT_ID is set and the gtag script has
// loaded (see components/Analytics.tsx) — safe to call unconditionally
// anywhere in the app, including before analytics is configured.
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
