from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.astrology import build_natal_chart, compute_synastry, compute_transits
from app.calc.models import (
    BirthData,
    NatalChart,
    SynastryRequest,
    SynastryResponse,
    TransitsRequest,
    TransitsResponse,
)
from app.rate_limit import limiter

router = APIRouter(prefix="/api/chart", tags=["chart"])


@router.post("/natal", response_model=NatalChart)
@limiter.limit("20/minute")
def natal_chart(request: Request, birth: BirthData, _user_id: str = Depends(require_user)) -> NatalChart:
    return build_natal_chart(birth)


@router.post("/transits", response_model=TransitsResponse)
@limiter.limit("20/minute")
def transits(request: Request, body: TransitsRequest, _user_id: str = Depends(require_user)) -> TransitsResponse:
    natal_longitudes = {p.name: p.longitude for p in body.natal_planets}
    return compute_transits(natal_longitudes)


@router.post("/synastry", response_model=SynastryResponse)
@limiter.limit("20/minute")
def synastry(request: Request, body: SynastryRequest, _user_id: str = Depends(require_user)) -> SynastryResponse:
    return compute_synastry(body.person_a, body.person_b)
