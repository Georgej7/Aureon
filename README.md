# Aureon — AI Spiritual Intelligence Platform

Prototype/demo of the landing page and core screens, built as a static
HTML/CSS/JS site. No backend, no real AI, no real payments — this is a
look-and-feel and interaction prototype, not the product.

## What's in this folder

- `index.html` — all screens (Landing, Onboarding, Dashboard, AI chat, Pricing), tab-switched via JS, no routing/build step
- `styles.css` — full visual system: dark/gold cosmic theme, HUD-style glass cards, curved topic wall
- `script.js` — all interactivity:
  - animated background (starfield, nebula, full 8-planet solar system with real relative
    orbital speeds, zodiac ring, asteroid belt, planet-to-planet aspect lines, a Mercury
    retrograde loop)
  - the "chart reveal" canvas animation on onboarding submit
  - the curved 3D topic-wall gallery (mouse-reactive)
  - topic sample-reading preview modal
  - browser-based text-to-speech on chat messages ("listen" button)
  - a simulated VIP "live voice call" screen (scripted replies, not real AI — see below)

## Honest state of things — read before you keep building

This is a prototype, and a few things in it are deliberately faked to show the *feeling*
of a feature without the real engineering behind it yet:

1. **No real chart/numerology calculation.** Everything shown (Saturn in 10th house, Life
   Path 8, etc.) is hardcoded sample copy. The real product needs a deterministic
   calculation engine (ephemeris-based astronomy + numerology arithmetic) — the LLM should
   never generate placements itself. This was flagged early and is still the most
   important unbuilt piece.
2. **The AI chat and voice call are scripted, not real.** No LLM is wired up. The voice
   call uses the browser's built-in `speechSynthesis` (real TTS, but generic quality) —
   production voice needs a real pipeline (speech-to-text + LLM + TTS, e.g. Deepgram/
   Whisper + Claude + ElevenLabs) and has real per-minute cost that should be modeled
   before pricing VIP.
3. **Tarot has no card content or art yet**, and popular illustrated decks are copyrighted —
   plan to commission original minimalist art (or use public-domain 1909 Rider-Waite-Smith
   scans as a stopgap) rather than scrape existing deck images.
4. **Knowledge base content should not be 100% AI-written.** Interpretive content (what a
   placement *means*) should get a pass from a credentialed practitioner per system before
   launch — this is a trust/quality requirement, not just a nice-to-have, especially since
   the target testers know these systems well.
5. **Performance has not been tested on real/low-end devices.** The background animation
   (nebula + starfield + full solar system with trails/aspects/retrograde + comets) is
   the heaviest thing in the file. It should be profiled on a mid/low-end phone before
   this look ships broadly — this was flagged multiple times during the build and is
   still outstanding.
6. **Copyright note:** the solar system/orbit visuals here were built from scratch in
   code (not traced from any reference footage/site) specifically to stay clean of
   copyright issues — keep it that way if you keep iterating on it.

## Suggested next steps in Claude Code

1. Open this folder in Claude Code and just ask it to keep iterating on the prototype
   (visuals, copy, new screens) — it can run a local server to preview changes live.
2. When ready to go from prototype to real product, the first real milestone is the
   calculation engine (birth data → accurate astrology/numerology output), independent
   of any UI — see the strategy doc for the recommended stack (Python/FastAPI for
   calculations, Next.js frontend, Supabase/Postgres + pgvector, Claude for the AI layer).
3. Don't skip the legal review on positioning language and any Middle East market
   plans — flagged early as a real requirement, not boilerplate caution.

## Running it locally

No build step needed. Either:
- Open `index.html` directly in a browser, or
- Run a simple local server from this folder (`python3 -m http.server 8000`) and visit
  `http://localhost:8000` — recommended once you're editing, so relative paths and any
  future fetch calls behave like they would in production.
