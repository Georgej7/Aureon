---
name: aureon-deploy-checklist
description: The build, test, seed, verify, commit, and push sequence for shipping backend or frontend changes to Aureon's live Render deployment. Load whenever a code change is about to be committed/pushed, or when knowledge base content changed.
---

# Aureon Deploy Checklist

Aureon deploys automatically from GitHub `main` to two Render services. There is no
staging environment — `main` is production. Follow this sequence in order; don't skip
steps to save time, each one has caught a real bug earlier in this project's history.

## Services

| Service | Render service ID | URL |
|---|---|---|
| `Aureon-backend` (FastAPI) | `srv-d9ijfhf41pts73bbu1rg` | `https://aureon-backend-g5c9.onrender.com` |
| `Aureon-frontend` (Next.js) | `srv-d9ijoivlk1mc73d6drsg` | `https://aureon-frontend.onrender.com` |

Both are free-tier — they spin down after inactivity (~50s cold-start delay on first
request after idle). Don't mistake a cold start for a broken deploy.

## 1. Test locally before touching git

- **Backend changed** (`backend/app/**`, `backend/tests/**`): activate the venv and run
  the full suite — `cd backend && source .venv/Scripts/activate && python -m pytest tests/ -v`.
  All tests must pass. If you added new calc logic, add a test for it in the same PR —
  every prior feature (transits, synastry, minor aspects, chart patterns) shipped with
  tests that construct known inputs and assert exact expected output, not just "doesn't crash."
- **Frontend changed** (`frontend/**`): `cd frontend && npm run build` (add
  `/c/Program Files/nodejs` to `PATH` first if `npm` isn't found — a recurring
  environment quirk in this session). This both type-checks and catches build errors;
  don't skip it even for "obviously safe" changes.

## 2. If knowledge_base JSON content changed

1. Validate every new/edited entry has all 14 required text fields non-empty (`system`,
   `category`, `topic`, `definition`, `traditional_interpretation`, `modern_interpretation`,
   `psychological_interpretation`, `positive_aspects`, `challenges`, `career_meaning`,
   `relationship_meaning`, `growth_meaning`, `sources`, `confidence_level`) — see the
   `aureon-knowledge-base-authoring` skill for the full schema and quality bar.
2. If it's a **new file**, add its path to `CONTENT_FILES` in `backend/knowledge_base/seed.py`.
3. Run the seed script against the **live** Supabase project (this upserts, safe to
   re-run):
   ```bash
   cd backend/knowledge_base
   export SUPABASE_URL="https://obbnltnrwxftgrgnmljc.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<from frontend/.env.local>"
   python3 seed.py
   ```
4. Confirm the entry count in the script's own output matches what you expect, then spot-check
   via a REST query (`GET .../rest/v1/knowledge_base?topic=eq.<Topic>`) that the new content
   actually landed.

## 3. If a Supabase schema/SQL migration is needed

Write it to `backend/migrations/00N_description.sql` (next sequential number), then apply
it via Supabase's SQL Editor. Automating this through browser control is fragile — the
Monaco editor's hidden `<textarea>` doesn't reliably accept synthetic clicks/keystrokes at
the coordinates a screenshot suggests. The reliable method: `document.querySelector('.monaco-editor textarea').focus()` via JS, verify `document.activeElement` really is that
textarea, *then* send keys — never trust a click landed without checking
`document.activeElement` first.

## 4. Commit and push — only with explicit per-instance permission

Never push without the user explicitly approving *this* push. Write a commit message that
explains *why*, not just what changed (see prior commits in this repo for the established
style — 1-2 sentence body explaining the reasoning, not a changelog).

## 5. Wait for Render auto-deploy, then verify live

Both services rebuild automatically on push to `main` (~50-70s each). After pushing:

1. Poll deploy status via the Render dashboard, or just wait ~90-100s.
2. Verify the **backend** directly with `curl` against a real endpoint — don't just check
   "Live" status in the Render UI, actually hit the API and check the response shape:
   ```bash
   curl -s -X POST https://aureon-backend-g5c9.onrender.com/api/chart/natal \
     -H "Content-Type: application/json" -d '{"datetime":"1993-03-14T04:12:00+04:00"}'
   ```
3. If the change touches Supabase writes (webhooks, profile updates), verify by querying
   the actual row afterward with the service-role key — a webhook or API route returning
   200 does **not** guarantee the database was actually updated (this exact gap caused a
   real silent-failure bug earlier in this project; the fix was checking `{data, error}`
   on every Supabase write, not just trusting a 200 response).
4. For frontend-only changes needing visual confirmation (not just a curl-testable API),
   ask the user to check — password-protected pages can't be verified by direct browser
   automation (entering credentials into any field is off-limits regardless of
   permission granted for browser control).

## 6. Report status honestly

State plainly what's verified (tests passed, live endpoint confirmed) versus what's
merely deployed-but-unverified (e.g., a UI-only change nobody's looked at yet). Don't
conflate "the deploy succeeded" with "the feature works."
