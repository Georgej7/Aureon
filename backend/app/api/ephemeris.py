from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import require_user
from app.calc.astrology import ephemeris_for_date, search_aspect
from app.calc.models import (
    AspectSearchHit,
    AspectSearchRequest,
    AspectSearchResponse,
    EphemerisDayRequest,
    EphemerisDayResponse,
)
from app.rate_limit import limiter

router = APIRouter(prefix="/api/ephemeris", tags=["ephemeris"])


@router.post("/day", response_model=EphemerisDayResponse)
@limiter.limit("30/minute")
def ephemeris_day(
    request: Request, body: EphemerisDayRequest, _user_id: str = Depends(require_user)
) -> EphemerisDayResponse:
    planets = ephemeris_for_date(body.date)
    return EphemerisDayResponse(date=body.date, planets=planets)


# Lower limit than most endpoints -- a single request here can scan up to
# 3650 days of ephemeris calculations server-side, meaningfully heavier than
# a single chart computation.
@router.post("/aspect-search", response_model=AspectSearchResponse)
@limiter.limit("6/minute")
def aspect_search(
    request: Request, body: AspectSearchRequest, _user_id: str = Depends(require_user)
) -> AspectSearchResponse:
    try:
        hits, searched_days = search_aspect(
            body.planet_a, body.planet_b, body.aspect_type, body.start_date, body.days
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return AspectSearchResponse(
        hits=[AspectSearchHit(date=d, orb=o, exact=e) for d, o, e in hits],
        searched_days=searched_days,
    )
