from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.astrology import (
    build_composite_chart,
    build_davison_chart,
    build_natal_chart,
    build_progressed_chart,
    build_solar_return_chart,
    build_vedic_chart,
    compute_synastry,
    compute_transits,
)
from app.calc.models import (
    BirthData,
    CompositeChartRequest,
    DavisonChartRequest,
    DavisonChartResponse,
    NatalChart,
    ProgressedChartRequest,
    ProgressedChartResponse,
    SolarReturnRequest,
    SolarReturnResponse,
    SynastryRequest,
    SynastryResponse,
    TransitsRequest,
    TransitsResponse,
    VedicChart,
)
from app.rate_limit import limiter

router = APIRouter(prefix="/api/chart", tags=["chart"])


@router.post("/natal", response_model=NatalChart)
@limiter.limit("20/minute")
def natal_chart(request: Request, birth: BirthData, _user_id: str = Depends(require_user)) -> NatalChart:
    return build_natal_chart(birth)


@router.post("/vedic", response_model=VedicChart)
@limiter.limit("20/minute")
def vedic_chart(request: Request, birth: BirthData, _user_id: str = Depends(require_user)) -> VedicChart:
    return build_vedic_chart(birth)


@router.post("/transits", response_model=TransitsResponse)
@limiter.limit("20/minute")
def transits(request: Request, body: TransitsRequest, _user_id: str = Depends(require_user)) -> TransitsResponse:
    natal_longitudes = {p.name: p.longitude for p in body.natal_planets}
    return compute_transits(natal_longitudes)


@router.post("/synastry", response_model=SynastryResponse)
@limiter.limit("20/minute")
def synastry(request: Request, body: SynastryRequest, _user_id: str = Depends(require_user)) -> SynastryResponse:
    return compute_synastry(body.person_a, body.person_b)


@router.post("/solar-return", response_model=SolarReturnResponse)
@limiter.limit("20/minute")
def solar_return(
    request: Request, body: SolarReturnRequest, _user_id: str = Depends(require_user)
) -> SolarReturnResponse:
    exact_datetime, chart = build_solar_return_chart(body)
    return SolarReturnResponse(exact_datetime=exact_datetime, chart=chart)


@router.post("/progressed", response_model=ProgressedChartResponse)
@limiter.limit("20/minute")
def progressed_chart(
    request: Request, body: ProgressedChartRequest, _user_id: str = Depends(require_user)
) -> ProgressedChartResponse:
    progressed_datetime, chart = build_progressed_chart(body)
    return ProgressedChartResponse(progressed_datetime=progressed_datetime, chart=chart)


@router.post("/davison", response_model=DavisonChartResponse)
@limiter.limit("20/minute")
def davison_chart(
    request: Request, body: DavisonChartRequest, _user_id: str = Depends(require_user)
) -> DavisonChartResponse:
    midpoint_datetime, chart = build_davison_chart(body)
    return DavisonChartResponse(midpoint_datetime=midpoint_datetime, chart=chart)


@router.post("/composite", response_model=NatalChart)
@limiter.limit("20/minute")
def composite_chart(
    request: Request, body: CompositeChartRequest, _user_id: str = Depends(require_user)
) -> NatalChart:
    return build_composite_chart(body)
