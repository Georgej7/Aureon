from fastapi import APIRouter

from app.calc.astrology import build_natal_chart, compute_synastry, compute_transits
from app.calc.models import (
    BirthData,
    NatalChart,
    SynastryRequest,
    SynastryResponse,
    TransitsRequest,
    TransitsResponse,
)

router = APIRouter(prefix="/api/chart", tags=["chart"])


@router.post("/natal", response_model=NatalChart)
def natal_chart(birth: BirthData) -> NatalChart:
    return build_natal_chart(birth)


@router.post("/transits", response_model=TransitsResponse)
def transits(request: TransitsRequest) -> TransitsResponse:
    natal_longitudes = {p.name: p.longitude for p in request.natal_planets}
    return compute_transits(natal_longitudes)


@router.post("/synastry", response_model=SynastryResponse)
def synastry(request: SynastryRequest) -> SynastryResponse:
    return compute_synastry(request.person_a, request.person_b)
