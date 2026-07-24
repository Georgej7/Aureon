from datetime import date, datetime

from fastapi import APIRouter

from app.calc.numerology import build_numerology_profile
from app.calc.models import NumerologyProfile, NumerologyRequest

router = APIRouter(prefix="/api/numerology", tags=["numerology"])


@router.post("", response_model=NumerologyProfile)
def numerology_profile(request: NumerologyRequest) -> NumerologyProfile:
    birth_date = date.fromisoformat(request.date)
    target_year = request.target_year or datetime.now().year
    return build_numerology_profile(request.full_name, birth_date, target_year)
