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

**Frontend**:
```
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`.

**Backend**:
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/health`.

## Status

Early scaffold stage. No calculation engine, no AI wiring, no payments yet — see the project brief
for the full MVP build order.
