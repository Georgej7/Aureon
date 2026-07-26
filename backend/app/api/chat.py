from fastapi import APIRouter
from pydantic import BaseModel

from app.ai.claude import generate_reply

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatReplyRequest(BaseModel):
    chart: dict
    numerology: dict
    knowledge: list[dict] = []
    messages: list[ChatMessage]
    transits: dict | None = None


class ChatReplyResponse(BaseModel):
    reply: str


@router.post("/reply", response_model=ChatReplyResponse)
def chat_reply(request: ChatReplyRequest) -> ChatReplyResponse:
    reply = generate_reply(
        request.chart,
        request.numerology,
        request.knowledge,
        [m.model_dump() for m in request.messages],
        request.transits,
    )
    return ChatReplyResponse(reply=reply)
