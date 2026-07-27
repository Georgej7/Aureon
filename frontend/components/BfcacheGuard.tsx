"use client";

import { useEffect } from "react";

/**
 * Safari's back-forward cache sometimes restores a frozen snapshot of a page
 * after a server-side redirect (e.g. the auth middleware's /login bounce) --
 * the page looks fine but stops responding to taps entirely, with no way out
 * except a real navigation like the browser's back button. A full reload on
 * bfcache restore forces a genuinely fresh, interactive page instead.
 */
export default function BfcacheGuard() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
