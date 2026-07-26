from datetime import date, datetime

from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.numerology import build_numerology_profile
from app.calc.models import NumerologyProfile, NumerologyRequest
from app.rate_limit import limiter

router = APIRouter(prefix="/api/numerology", tags=["numerology"])


@router.post("", response_model=NumerologyProfile)
@limiter.limit("20/minute")
def numerology_profile(
    request: Request, body: NumerologyRequest, _user_id: str = Depends(require_user)
) -> NumerologyProfile:
    birth_date = date.fromisoformat(body.date)
    target_year = body.target_year or datetime.now().year
    return build_numerology_profile(body.full_name, birth_date, target_year)
