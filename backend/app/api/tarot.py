from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.models import TarotCard, TarotDrawRequest
from app.calc.tarot import draw_card
from app.rate_limit import limiter

router = APIRouter(prefix="/api/tarot", tags=["tarot"])


@router.post("/draw", response_model=TarotCard)
@limiter.limit("20/minute")
def draw(request: Request, body: TarotDrawRequest, _user_id: str = Depends(require_user)) -> TarotCard:
    name, upright = draw_card(body.seed)
    return TarotCard(name=name, upright=upright)
