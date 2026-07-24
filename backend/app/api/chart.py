from fastapi import APIRouter

from app.calc.astrology import build_natal_chart
from app.calc.models import BirthData, NatalChart

router = APIRouter(prefix="/api/chart", tags=["chart"])


@router.post("/natal", response_model=NatalChart)
def natal_chart(birth: BirthData) -> NatalChart:
    return build_natal_chart(birth)
