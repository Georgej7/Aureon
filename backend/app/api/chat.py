from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from app.ai.claude import generate_reply
from app.auth import enforce_free_tier_limit, verify_supabase_user
from app.rate_limit import limiter

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
@limiter.limit("10/minute")
def chat_reply(
    request: Request, body: ChatReplyRequest, authorization: str | None = Header(default=None)
) -> ChatReplyResponse:
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_free_tier_limit(user_id, token)

    reply = generate_reply(
        body.chart,
        body.numerology,
        body.knowledge,
        [m.model_dump() for m in body.messages],
        body.transits,
    )
    return ChatReplyResponse(reply=reply)
