# Aureon backend

FastAPI + a deterministic calculation engine (`app/calc/`) for natal charts (Swiss Ephemeris via
`pyswisseph`) and numerology (Pythagorean system). No RAG/knowledge base or AI wiring yet — those
come after this per the project brief's MVP order. The non-negotiable rule: the LLM never
calculates charts — this engine is the only source of astrology/numerology numbers.

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

## Tests

```
python -m pytest -v
```

Astrology tests verify the engine against independently documented astronomical events (equinox/
solstice instants where the Sun's ecliptic longitude is exactly 0/90/180/270 degrees) rather than a
scraped third-party chart. Numerology tests use hand/independently derived arithmetic examples.
