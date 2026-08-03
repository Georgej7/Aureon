# Aureon — Master To-Do List

Consolidated from `PROJECT-BRIEF.md`, `marketing/plan.md`, and `aureon-website/README.md`.
Last updated: 2026-07-30. This is a living checklist — update it as items land or priorities shift,
don't let it go stale.

---

## 🔴 Blocked on funds (Gio only — needs your accounts/payment)

- [ ] Add Anthropic billing credits (console.anthropic.com) — unlocks real AI chat, currently stub mode
- [ ] Buy domain `askaureon.com` (~$12/yr, Porkbun)
- [ ] Register business entity (Georgia)
- [ ] Point Render custom domain + DNS at the new domain
- [ ] Verify domain with Resend — unlocks real welcome/lifecycle email delivery

---

## 🟢 Available right now — Marketing (zero funds needed)

- [ ] **Start community engagement** — r/astrology, multi-system Discords. Personal, genuine, no product mentions yet. This is 100% on Gio, can't be delegated, and should start today, not wait for launch.
- [ ] Draft the remaining 8 content pieces (#2-9 of the Q1 calendar) — piece #1 is already fully written
- [ ] Create a free GA4 property + get the Measurement ID → wire into `.env.local` (code already supports it)
- [ ] Reserve social handles (X, newsletter platform) ahead of the public launch moment

## 🟢 Available right now — Engineering (zero funds needed)

- [ ] Decide the free-tier paywall trigger (message count vs. system count) — currently undecided, flagged as a Q2 test but could be settled sooner
- [ ] Re-verify the "known minor visual bug" on the landing page flagged in the marketing plan — may already be fixed by recent commits (Saturn texture, gate icon reverts)
- [ ] Real legal review of Terms/Privacy language before any ads run (per `PROJECT-BRIEF.md` §9) — positioning must stay "reflection/entertainment," not predictive-certainty framing

## 🔵 Bigger, not-yet-started product features (no fixed timeline)

- [ ] Human Design system (calculation + knowledge base + UI) — not started
- [ ] Tarot — 22 Major Arcana + AI interpretation; needs an art decision first (commission original minimalist art vs. 1909 Rider-Waite-Smith public-domain stopgap)
- [ ] Dedicated Moon Cycles feature/page — currently only folded into chat's transit summaries, not a standalone experience
- [ ] Matrix of Destiny — lowest priority per build order, validate demand first
- [ ] Chinese astrology — lowest priority per build order, validate demand first
- [ ] VIP "Listen" mode upgrade — currently uses the browser's built-in TTS (works, sounds robotic); production-quality version should use a real TTS service (e.g. ElevenLabs)
- [ ] Live AI voice call (VIP) — explicitly a later-phase feature, high latency/cost complexity; only build after Listen mode validates real demand for voice at all

---

## ⏳ Do the moment funds land

- [ ] Personally test real Claude chat quality before any public push — nobody has talked to it for real yet
- [ ] Publish content piece #1 as the launch-day anchor post
- [ ] Switch Paddle from sandbox to live keys/price IDs when ready to accept real payments
- [ ] Confirm the custom domain is fully live and Resend is verified

---

## 📊 Ongoing / operational — no end date

- [ ] Weekly Gio + Donna check-in: content shipped vs. planned, blockers, community read
- [ ] Monthly full-funnel review once real signup/usage data exists
- [ ] Quarterly plan recalibration — revisit `marketing/plan.md`, don't let it go stale
- [ ] Watch **Week-4 retained active users** (the north-star metric) above all else once real users exist

---

## Already done — for context, not to re-do

Calculation engine · knowledge base + RAG (western/vedic astrology, numerology, feng shui — 158 entries) ·
auth + persistent chat history · Free/Premium/VIP Paddle subscriptions · VIP feng shui differentiator ·
brand voice doc · Q1 content calendar (planned) · win-back email sequences · GA4 code (needs property ID) ·
VIP Paddle env vars confirmed live on Render (sandbox mode).
