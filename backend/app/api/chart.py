from fastapi import APIRouter

from app.calc.astrology import build_natal_chart, compute_transits
from app.calc.models import BirthData, NatalChart, TransitsRequest, TransitsResponse

router = APIRouter(prefix="/api/chart", tags=["chart"])


@router.post("/natal", response_model=NatalChart)
def natal_chart(birth: BirthData) -> NatalChart:
    return build_natal_chart(birth)


@router.post("/transits", response_model=TransitsResponse)
def transits(request: TransitsRequest) -> TransitsResponse:
    natal_longitudes = {p.name: p.longitude for p in request.natal_planets}
    return compute_transits(natal_longitudes)
