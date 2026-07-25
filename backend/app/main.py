import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api import chart, chat, numerology  # noqa: E402 (must follow load_dotenv())

app = FastAPI(title="Aureon API")

# Comma-separated list of allowed frontend origins, e.g.
# "http://localhost:3000,https://aureon.vercel.app". Always includes localhost
# so local dev keeps working regardless of what's set in production.
_extra_origins = os.environ.get("CORS_ORIGINS", "")
allow_origins = ["http://localhost:3000"] + [o.strip() for o in _extra_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chart.router)
app.include_router(numerology.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "ok"}
