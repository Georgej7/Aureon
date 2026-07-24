# Aureon backend

FastAPI + a deterministic calculation engine (`app/calc/`) for natal charts (Swiss Ephemeris via
`pyswisseph`) and numerology (Pythagorean system), plus a stateless AI chat-reply endpoint
(`app/ai/`). No RAG/knowledge base yet — chat responds directly from chart + numerology context
rather than curated reference content, skipped ahead of for now (see PROJECT-BRIEF.md). The
non-negotiable rule: the LLM never calculates charts — the calc engine is the only source of
astrology/numerology numbers; Claude only synthesizes/converses.

This backend is intentionally stateless and holds no user data or Supabase credentials — auth and
all persistence (profiles, chat history) live entirely in the frontend via Supabase, enforced by
Postgres Row Level Security. The backend just computes charts/numerology and generates chat replies
from whatever context it's given in the request body.

## Requirements

**Python 3.11 specifically** — `pyswisseph` only ships prebuilt wheels up to CPython 3.11, and this
project doesn't assume a C compiler is available to build it from source. If the system default
Python is newer, install 3.11 separately (`winget install Python.Python.3.11` on Windows) and point
the venv at it explicitly.

## Running locally

```
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/health` — should return `{"status": "ok"}`.
Interactive API docs: `http://localhost:8000/docs`.

Endpoints:
- `POST /api/chart/natal` — body: `{"datetime": "1993-03-14T04:12:00+04:00", "latitude": 41.7151, "longitude": 44.8271}` (datetime must carry a UTC offset; no geocoding — pass lat/lon directly)
- `POST /api/numerology` — body: `{"full_name": "Jordan Rivera", "date": "1993-03-14"}`
- `POST /api/chat/reply` — body: `{"chart": {...}, "numerology": {...}, "messages": [{"role": "user", "content": "..."}]}`.
  Returns a clearly-labeled stub reply until `ANTHROPIC_API_KEY` is set (copy `.env.example` to
  `.env`); once set, calls Claude for real using the chart/numerology as system-prompt context.

## Tests

```
python -m pytest -v
```

Astrology tests verify the engine against independently documented astronomical events (equinox/
solstice instants where the Sun's ecliptic longitude is exactly 0/90/180/270 degrees) rather than a
scraped third-party chart. Numerology tests use hand/independently derived arithmetic examples.
