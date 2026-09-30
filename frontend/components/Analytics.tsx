"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { disableAnalytics, enableAnalytics, GA_MEASUREMENT_ID, trackPageView } from "@/lib/analytics";
import { consent } from "@/lib/consent";

/**
 * Loads GA4 only after the visitor has accepted analytics (see ConsentBanner).
 * Without consent this renders nothing: no gtag.js, no cookies, no requests.
 *
 * Next's App Router doesn't full-reload between routes, so GA4's default
 * on-load pageview only fires once. lib/analytics.ts disables the automatic
 * one (send_page_view: false) and this sends exactly one page_view per route
 * change instead, including the moment consent is given. Only the pathname is
 * used: query strings and fragments never go to GA4 (see sanitizePath).
 *
 * Initialization lives in lib/analytics.ts (not an inline <Script>) so the
 * gtag queue always exists before the first event; this component only loads
 * gtag.js itself.
 */
export default function Analytics() {
  const pathname = usePathname();
  const choice = useSyncExternalStore(consent.subscribe, consent.read, () => null);
  const granted = choice === "granted";

  // Consent granted (or restored from storage) -> allow collection; absent or
  // withdrawn -> switch it off and remove any GA cookies.
  useEffect(() => {
    if (granted) enableAnalytics();
    else disableAnalytics();
  }, [granted]);

  useEffect(() => {
    if (granted) trackPageView(pathname);
  }, [granted, pathname]);

  if (!GA_MEASUREMENT_ID || !granted) return null;

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />;
}
