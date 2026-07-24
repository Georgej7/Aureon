# Aureon backend

FastAPI skeleton. No calculation engine, RAG, or AI wiring yet — see the root README and the
project brief for the planned build order.

## Running locally

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/health` — should return `{"status": "ok"}`.
