from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from app.ai.claude import generate_reply
from app.auth import enforce_free_tier_limit, verify_supabase_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str = Field(max_length=4000)


class ChatReplyRequest(BaseModel):
    chart: dict
    numerology: dict
    knowledge: list[dict] = []
    messages: list[ChatMessage] = Field(max_length=200)
    transits: dict | None = None


class ChatReplyResponse(BaseModel):
    reply: str


@router.post("/reply", response_model=ChatReplyResponse)
def chat_reply(request: ChatReplyRequest, authorization: str | None = Header(default=None)) -> ChatReplyResponse:
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_free_tier_limit(user_id, token)

    reply = generate_reply(
        request.chart,
        request.numerology,
        request.knowledge,
        [m.model_dump() for m in request.messages],
        request.transits,
    )
    return ChatReplyResponse(reply=reply)
