"use client";

// Page.tsx is a server component (no onClick allowed there), so the trigger
// lives in this tiny client component instead. Toggling is a plain DOM body
// class, not React state -- see SkyViewExit.tsx for the other half.
export default function SkyViewButton() {
  return (
    <button type="button" className="sky-view-btn" onClick={() => document.body.classList.add("sky-view")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" />
        <circle cx="12" cy="12" r="3.4" />
      </svg>
      View the sky
    </button>
  );
}
