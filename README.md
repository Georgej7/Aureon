# Aureon

AI-powered self-development platform synthesizing Western astrology, numerology, Matrix of
Destiny, Human Design, Tarot, moon cycles, Chinese astrology, and psychological self-development
into one product with an AI advisor that has durable memory of the user.

Positioned as reflection, entertainment, and self-development — never predictive certainty about
someone's life.

## Repository layout

- **`prototype/`** — the original static HTML/CSS/JS visual/interaction prototype (no backend, no
  real AI, no real calculations). Kept as the visual design reference. See
  [`prototype/README.md`](prototype/README.md) for what's real vs. faked in it.
- **`frontend/`** — the real product frontend: Next.js (TypeScript, App Router), porting the
  prototype's design system into real routes.
- **`backend/`** — the real product backend: FastAPI (Python), starting point for the deterministic
  calculation engine (ephemeris + numerology), RAG knowledge base, and AI chat layer.

## Architecture (decided)

- Frontend: Next.js (SSR/SSG for organic search traffic)
- Backend: Python/FastAPI (ephemeris-based astronomy libraries for chart calculation)
- Database: PostgreSQL via Supabase + pgvector for memory/embeddings (no separate vector DB)
- AI: Claude via the Anthropic API
- Payments: Stripe with Stripe Tax (EU VAT), billed directly rather than via app-store IAP

**Non-negotiable rule**: the LLM never calculates charts. Deterministic calculation engine produces
structured chart data → RAG retrieval against the knowledge base → Claude synthesizes retrieved
interpretations into a conversational reply. Claude's job is synthesis and conversation, never
computation of placements.

## Running locally

**Supabase** (auth + all persistence — profiles, chat history): create a free project at
supabase.com, run `backend/migrations/001_init.sql` in its SQL Editor, then copy
`frontend/.env.local.example` to `frontend/.env.local` and fill in the project URL + anon key.

**Frontend**:
```
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`.

**Backend** (Python 3.11 specifically — see `backend/README.md`):
```
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/health`. Copy `backend/.env.example` to `backend/.env` and set
`ANTHROPIC_API_KEY` for real chat replies — chat runs in an honestly-labeled stub mode without it.

## Status

Calculation engine (astrology + numerology), registration/login, and persistent chat history are
built. Chat responds directly from chart/numerology context — no knowledge base yet, and no real
Claude replies until an Anthropic key is configured. No payments yet. See the project brief for the
full MVP build order.
