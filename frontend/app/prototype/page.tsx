"use client";

import dynamic from "next/dynamic";

// WebGL needs a real browser context (canvas, WebGL2) -- never render on
// the server. This route is intentionally unlinked from nav; it's a
// throwaway proof-of-concept, not a page meant to be discovered yet.
const SaturnPrototype = dynamic(() => import("@/components/SaturnPrototype"), {
  ssr: false,
});

export default function PrototypePage() {
  return <SaturnPrototype />;
}
