"use client";

import { useEffect } from "react";

// Lives outside .app in layout.tsx (see SkyViewButton's comment for why),
// so it's still on screen when body.sky-view hides everything else.
// Visibility is pure CSS (body.sky-view .sky-view-exit{display:flex}) --
// no shared React state needed between the trigger and this exit control,
// just a body class both sides read/write via plain DOM calls.
export default function SkyViewExit() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") document.body.classList.remove("sky-view");
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <button
      type="button"
      className="sky-view-exit"
      onClick={() => document.body.classList.remove("sky-view")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
      Back to Aureon
    </button>
  );
}
