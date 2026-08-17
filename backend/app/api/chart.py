from fastapi import APIRouter, Depends, Header, Request

from app.auth import enforce_min_tier, require_user, verify_supabase_user
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


def _require_tier(authorization: str | None, minimum: str) -> None:
    """require_user only confirms the caller is signed in -- it discards the
    raw token, so it can't check subscription_tier. These endpoints back a
    paid feature (Premium for vedic/synastry, Practitioner for the rest),
    previously gated only by a frontend React conditional -- see
    enforce_min_tier's docstring for why that's not actually a gate."""
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_min_tier(user_id, token, minimum)


@router.post("/natal", response_model=NatalChart)
@limiter.limit("20/minute")
def natal_chart(request: Request, birth: BirthData, _user_id: str = Depends(require_user)) -> NatalChart:
    return build_natal_chart(birth)


@router.post("/vedic", response_model=VedicChart)
@limiter.limit("20/minute")
def vedic_chart(request: Request, birth: BirthData, authorization: str | None = Header(default=None)) -> VedicChart:
    _require_tier(authorization, "premium")
    return build_vedic_chart(birth)


@router.post("/transits", response_model=TransitsResponse)
@limiter.limit("20/minute")
def transits(request: Request, body: TransitsRequest, _user_id: str = Depends(require_user)) -> TransitsResponse:
    natal_longitudes = {p.name: p.longitude for p in body.natal_planets}
    return compute_transits(natal_longitudes)


@router.post("/synastry", response_model=SynastryResponse)
@limiter.limit("20/minute")
def synastry(
    request: Request, body: SynastryRequest, authorization: str | None = Header(default=None)
) -> SynastryResponse:
    _require_tier(authorization, "premium")
    return compute_synastry(body.person_a, body.person_b)


@router.post("/solar-return", response_model=SolarReturnResponse)
@limiter.limit("20/minute")
def solar_return(
    request: Request, body: SolarReturnRequest, authorization: str | None = Header(default=None)
) -> SolarReturnResponse:
    _require_tier(authorization, "practitioner")
    exact_datetime, chart = build_solar_return_chart(body)
    return SolarReturnResponse(exact_datetime=exact_datetime, chart=chart)


@router.post("/progressed", response_model=ProgressedChartResponse)
@limiter.limit("20/minute")
def progressed_chart(
    request: Request, body: ProgressedChartRequest, authorization: str | None = Header(default=None)
) -> ProgressedChartResponse:
    _require_tier(authorization, "practitioner")
    progressed_datetime, chart = build_progressed_chart(body)
    return ProgressedChartResponse(progressed_datetime=progressed_datetime, chart=chart)


@router.post("/davison", response_model=DavisonChartResponse)
@limiter.limit("20/minute")
def davison_chart(
    request: Request, body: DavisonChartRequest, authorization: str | None = Header(default=None)
) -> DavisonChartResponse:
    _require_tier(authorization, "practitioner")
    midpoint_datetime, chart = build_davison_chart(body)
    return DavisonChartResponse(midpoint_datetime=midpoint_datetime, chart=chart)


@router.post("/composite", response_model=NatalChart)
@limiter.limit("20/minute")
def composite_chart(
    request: Request, body: CompositeChartRequest, authorization: str | None = Header(default=None)
) -> NatalChart:
    _require_tier(authorization, "practitioner")
    return build_composite_chart(body)
