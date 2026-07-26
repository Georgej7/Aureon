---
name: aureon-knowledge-base-authoring
description: Schema, tone, and workflow for adding new astrology/numerology knowledge_base content to Aureon. Load before writing any new JSON content file under backend/knowledge_base/.
---

# Aureon Knowledge Base Content Authoring

The knowledge base is what keeps the AI chat grounded in reviewed, sourced content
instead of freewheeling on general training knowledge (see the architecture rule: LLM
never calculates charts, and it shouldn't invent interpretive content either — everything
it says about a placement should trace back to a knowledge_base row). Every entry in this
system meets a real quality bar — match it, don't write filler.

## File layout

```
backend/knowledge_base/
  western_astrology/
    planets.json          # 10 entries — one per planet
    signs.json             # 12 entries — one per zodiac sign
    houses.json            # 12 entries — one per house
    aspects.json           # 9 entries — 5 major + 4 minor aspects
    retrogrades.json       # 8 entries — "{Planet} Retrograde" (no Sun/Moon, they can't retrograde)
    transiting_planets.json # 10 entries — "Transiting {Planet}" (temporary-energy framing)
    moon_phases.json       # 8 entries — the 8 lunar phases
    synastry_aspects.json  # 5 entries — "Synastry {Aspect}" (two-person framing)
    chart_patterns.json    # 5 entries — Stellium, Grand Trine, T-Square, Grand Cross, Yod
  numerology/
    numbers.json           # 12 entries — 1-9, 11, 22, 33
  seed.py                  # loader — CONTENT_FILES list must include every file above
```

**Key principle:** don't try to cover every combination (e.g. never write
"Mars in Aries in the 7th House" as one entry — that's an unbounded combinatorial
explosion). Instead add one new *dimension* (planet × sign, transiting-planet, aspect-type)
and let the AI chat synthesize combinations at reply time from several matched entries
plus the user's actual computed chart data. This is why retrogrades/transits/synastry each
only needed 5-10 new entries, not hundreds.

## Required schema (every field mandatory except `context_notes`)

```json
{
  "system": "western_astrology",       // or "numerology"
  "category": "planet",                 // groups related topics — see categories above
  "topic": "Sun",                       // exact string the app looks up by
  "definition": "...",                  // 1-2 sentences, what this fundamentally is
  "traditional_interpretation": "...",  // classical/historical reading
  "modern_interpretation": "...",       // contemporary psychological astrology reading
  "psychological_interpretation": "...",// depth-psychology angle (Jungian etc.)
  "positive_aspects": "...",            // strengths, short phrase list in prose
  "challenges": "...",                  // shadow side, short phrase list in prose
  "career_meaning": "...",              // how it shows up professionally
  "relationship_meaning": "...",        // how it shows up in relationships
  "growth_meaning": "...",              // the growth edge / what integration looks like
  "sources": ["Author, \"Book Title\"", "..."], // 2-3 real, specific cited works
  "confidence_level": "high",           // "high" for majors, "medium" for minor/derived content
  "context_notes": null                 // numerology-only: per-category variants, see below
}
```

`(system, category, topic)` is a unique constraint in the database — reusing an existing
triple upserts over it rather than erroring, which is safe but means a typo in `topic`
creates a silent duplicate instead of a loud failure. Double-check topic strings match
exactly what the frontend queries (grep `topicsForProfile` in `ChatWindow.tsx` and the
dashboard/compatibility pages for the exact string format expected).

### `context_notes` (numerology only)

Numerology numbers mean something different depending on which calculation produced them
(Life Path vs. Expression vs. Soul Urge vs. Personality). Rather than 4x the entries,
`numbers.json` uses one entry per number with a `context_notes` object:

```json
"context_notes": {
  "life_path": "As a Life Path, 1 points to...",
  "expression": "As an Expression/Destiny number, 1 shows...",
  "soul_urge": "As a Soul Urge, 1 reveals...",
  "personality": "As a Personality number, 1 gives..."
}
```

## Tone and quality bar

Read 2-3 existing entries in the relevant file before writing new ones — they're the
actual style guide. In short: full paragraphs, not bullet fragments; real named sources
(Liz Greene, Robert Hand, Stephen Arroyo, Steven Forrest, Sue Tompkins are the recurring
names in this project — stay within recognized astrology/numerology authors, don't
fabricate citations); psychologically literate but never predictive/deterministic language
("often shows up as," "tends to," never "you will"); each of the 12 content fields should
say something *specific* to that topic, not a reusable template with the name swapped in.

## Workflow

1. Write the JSON file (or add entries to an existing one) matching the schema above.
2. Validate before seeding:
   ```bash
   python3 -c "
   import json
   required = ['system','category','topic','definition','traditional_interpretation',
       'modern_interpretation','psychological_interpretation','positive_aspects',
       'challenges','career_meaning','relationship_meaning','growth_meaning',
       'sources','confidence_level']
   d = json.load(open('path/to/file.json', encoding='utf-8'))
   for e in d:
       missing = [k for k in required if k not in e or not e[k]]
       if missing: print('MISSING', e.get('topic'), missing)
   print(len(d), 'entries validated')
   "
   ```
3. If it's a new file, add its path to `CONTENT_FILES` in `seed.py`.
4. Follow the `aureon-deploy-checklist` skill's step 2 to seed it live and confirm it landed.
5. If the new category needs new *topics requested* (not just stored) — e.g. a new
   dimension like retrogrades needed `ChatWindow.tsx`'s `topicsForProfile()` to actually
   add `"{Planet} Retrograde"` to the lookup set — update that function too, or the
   content will sit in the database unused.
