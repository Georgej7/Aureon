from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api import chart, chat, numerology  # noqa: E402 (must follow load_dotenv())

app = FastAPI(title="Aureon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
