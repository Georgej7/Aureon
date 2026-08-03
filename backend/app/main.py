import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

load_dotenv()

from app.api import (  # noqa: E402 (must follow load_dotenv())
    chart,
    chat,
    chinese_astrology,
    electional,
    feng_shui,
    human_design,
    numerology,
    tarot,
)
from app.rate_limit import limiter  # noqa: E402 (must follow load_dotenv())

app = FastAPI(title="Aureon API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
app.include_router(feng_shui.router)
app.include_router(tarot.router)
app.include_router(chinese_astrology.router)
app.include_router(human_design.router)
app.include_router(electional.router)


@app.get("/health")
def health():
    return {"status": "ok"}
