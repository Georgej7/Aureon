# Aureon — Brand Voice Guide v1

Formalizes Marketing Plan §2's voice rules into a standalone, checkable reference. This is a living document — update it when a piece of copy teaches us something the rules below don't yet cover, don't treat it as fixed on first publish.

**Who this is for:** anyone writing anything a user will read — landing page copy, emails, social posts, in-app microcopy, support replies. Currently that's Donna (drafts) and Gio (final check, per the marketing plan's RACI). Every piece of content this project produces should be checkable against this doc before it ships.

---

## The one-line essence

**An orbit, not a horoscope.** Something that moves and accumulates context with you, not something that resets every morning. If a piece of copy could just as easily describe a daily horoscope app, it's off-voice — the whole point is that Aureon isn't that.

## Who we're talking to

Beachhead: people who already run a multi-system practice (astrology + numerology + tarot + human design + feng shui, in some combination) and are tired of reconciling conflicting apps themselves. They are not beginners who need spiritual concepts explained from scratch, and they are not skeptics who need to be convinced astrology is "real." Write to someone who already takes this seriously and wants a tool that does too. See Marketing Plan §2 for the full ICP.

---

## Tone, precisely

Not just "warm" or "grounded" — those words alone don't stop anyone from writing badly. Each tone attribute below is paired with what it is *not*, because the failure mode is usually the near-miss, not the opposite.

| We are | Not | Because |
|---|---|---|
| Grounded | Clinical or cold | Grounded means specific and honest, not detached — "a numerology cycle that rewards patience over speed this month," not a lab report |
| Specific | Vague-mystical | Real placements, real mechanisms, real numbers. "Your Saturn in the 10th house" beats "the universe is asking something of you" every time |
| Honest about mechanism | Overclaiming the AI | Say what's calculated (real) vs. interpreted (AI, working from real data) — never blur the two |
| Quietly confident | Salesy or urgent | No countdown timers, no "don't miss out," no manufactured scarcity — see CTA rules below |
| Respectful of the reader's agency | Prescriptive or certain | "Worth sitting with," "worth noticing" — never "you must," never "this will happen" |
| A little dry, occasionally wry | Twee or precious | Fine to be plainly funny about the category ("closer to a fortune cookie with better production values") — never cutesy about the user's actual life |

---

## Vocabulary

**Reach for:** reflection, self-development, synthesis, reconcile/reconciling, grounded, worth sitting with, worth noticing, precise, real (real data, real calculation, real transit), continuity, memory, holds/held (as in "holds your context"), practice (as in "a multi-system practice").

**Avoid:** predicts/prediction, will happen, destined, fated, the universe wants/is asking, unlock your potential, manifest, energy (ungrounded — "emotional weather" or "orientation" reads more honestly than "energy" alone), any daily-horoscope stock phrases ("today is a great day for..."), superlatives without a specific referent ("amazing," "incredible," "life-changing").

**Never, under any framing:** claims that a system is more legitimate than another it's being synthesized with. If a piece compares Western and Vedic astrology, neither gets to "win" — see Content Calendar Piece 1 and Piece 4 for the worked example of how to write this correctly.

---

## Sentence-level patterns

Pulled from what's already shipped (landing page, win-back emails, content calendar) — these aren't invented rules, they're what the existing voice actually does:

- **Short declarative openers, then one longer sentence that earns its length.** "Neither is wrong. They're measuring different things." then a sentence that explains why.
- **Name the mechanism before the meaning.** "Western astrology places your Moon using the tropical zodiac — anchored to the equinoxes" comes before what that means for the reader. Mechanism first builds the trust that makes the interpretation land.
- **One honest hedge per claim, not zero and not five.** "Traditionally, it's the placement used for timing" — enough to avoid overclaiming, not so much it reads as unsure of itself.
- **CTAs are declarative sentences, not commands with exclamation points.** "Create your profile." "See a sample reading." "Open your dashboard." Never "Get started now!!" or "Don't wait."
- **Em dashes over semicolons**, consistently, across every piece of copy shipped so far — a real, distinctive rhythm marker worth protecting rather than "correcting" toward more formal punctuation.

---

## The four non-negotiables

(Full versions in Marketing Plan §2 — restated here as a quick check.)

1. **No predictive claims.** Never "this will happen." Always "worth sitting with," "worth noticing," "a cycle that rewards X."
2. **No system hierarchy.** Astrology, numerology, Vedic, feng shui — none is "the real one." Every comparison piece treats both sides as legitimate, different instruments.
3. **No daily-disposable framing.** Nothing should read like it forgot yesterday. Continuity is the differentiator — see Content Calendar Pieces 7 and 9.
4. **No AI overclaiming.** The honest claim is memory and synthesis of real calculated data — never "understands you" or "knows your future."

---

## CTA rules

- Declarative, present-tense, no exclamation points: "Create your profile," "See a sample reading," "Come back anytime."
- No urgency, no scarcity, no guilt. The win-back email sequence is the clearest example of this in practice — each of the three touches gets *quieter*, not more insistent, and the last one explicitly says "if now's genuinely not the right time, that's a completely fine answer."
- A CTA can be soft ("see how →") when it's inside content, not just on product pages — content pieces shouldn't read like ads even when they end with one.

---

## Before / after

**Bad (generic astrology-app voice):**
> ✨ Your Moon is calling! Discover what the stars have planned for you today. Don't miss this powerful moment — tap in now to unlock your destiny! 🌙

**Aureon voice, same underlying content:**
> Your Moon sign describes your emotional style — how you process feeling, what comforts you. Worth checking against what's actually on your mind this week, not because the stars planned it, but because the pattern might be worth noticing.

What changed: no emoji-as-punctuation, no "unlock/destiny/calling," no urgency, mechanism named plainly, agency handed back to the reader in the last clause.

---

## Self-check before publishing anything

Run every piece of copy — landing page, email, social post, in-app text — through this before it ships:

1. Could this sentence appear verbatim in a generic daily-horoscope app? If yes, it's probably too vague — get specific.
2. Does it claim anything will happen, or does it leave room for the reader's own judgment?
3. If it compares two systems, does either one get treated as more "real" than the other?
4. If it mentions the AI, is the claim about memory/synthesis of real data — not about the AI "understanding" or "knowing" something it can't?
5. Does the CTA read like an instruction to a friend, or like a marketing department wrote it?
6. Read it once at half speed. If it sounds like it's trying to sound spiritual rather than actually saying something, cut it.

---

## Reference examples already shipped

Point to these when a new piece needs a model to work from, rather than starting from the abstract rules alone:

- **Landing page** (`frontend/app/page.tsx`) — the feature grid's four cards are the tightest existing expression of the whole voice in ~15 words each.
- **Content Calendar Piece 1** (`marketing/content-calendar-q1.md`) — the canonical example of comparing two systems without ranking them.
- **Content Calendar Piece 5** — the canonical example of naming a real category problem (AI-generated horoscope slop) honestly, without naming competitors or resorting to a takedown tone.
- **Win-back email sequence** (`frontend/lib/email/templates.ts`) — the canonical example of a retention mechanic that gets gentler, not pushier, across three touches.
