"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { consent } from "@/lib/consent";

// "ssr" keeps the banner out of the server render and the hydration pass, so
// returning visitors never see it flash; it only appears once the stored
// choice has actually been read and found absent.
const useChoice = () => useSyncExternalStore(consent.subscribe, consent.read, () => "ssr" as const);

/**
 * Asks for analytics consent. Renders nothing at all unless GA4 is configured
 * (nothing to consent to) and the visitor hasn't chosen yet. Accept and Reject
 * are deliberately identical in weight, and rejecting is as easy as accepting.
 */
export default function ConsentBanner() {
  const choice = useChoice();
  if (!GA_MEASUREMENT_ID || choice !== null) return null;

  return (
    <div className="consent-banner print-hide" role="dialog" aria-label="Analytics cookies" aria-describedby="consent-desc">
      <p className="consent-title serif">Analytics cookies</p>
      <p id="consent-desc">
        May we use Google Analytics to see which pages are visited, so we can improve Aureon? It sets cookies and shares
        page visits and device information with Google. It never receives your birth details, readings or chats. Details
        in our <Link href="/privacy#analytics">Privacy Policy</Link>.
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-ghost" onClick={consent.reject}>
          Reject
        </button>
        <button type="button" className="btn btn-ghost" onClick={consent.accept}>
          Accept
        </button>
      </div>
    </div>
  );
}

/** Footer control to change or withdraw the choice at any time. Hidden when analytics isn't configured. */
export function ConsentSettingsLink() {
  const choice = useChoice();
  if (!GA_MEASUREMENT_ID || choice === "ssr") return null;
  return (
    <button type="button" className="link-button" onClick={consent.clear}>
      Analytics settings
    </button>
  );
}
