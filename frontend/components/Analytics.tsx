"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { GA_MEASUREMENT_ID, trackPageView } from "@/lib/analytics";

/**
 * Next's App Router doesn't full-reload between routes, so GA4's default
 * on-load pageview only fires once. lib/analytics.ts disables the automatic
 * one (send_page_view: false) and this sends exactly one page_view per route
 * change instead, including the first load. Only the pathname is used: query
 * strings and fragments never go to GA4 (see sanitizePath).
 *
 * Initialization lives in lib/analytics.ts (not an inline <Script>) so the
 * gtag queue always exists before the first event, whichever component's
 * effect happens to run first; this component only loads gtag.js itself.
 */
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  if (!GA_MEASUREMENT_ID) return null;

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />;
}
