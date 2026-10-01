import datetime as dt
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from app.calc.timezone import OffsetCandidate, resolve_birth_timezone
from app.rate_limit import limiter

router = APIRouter(prefix="/api/timezone", tags=["timezone"])


class TimezoneRequest(BaseModel):
    """Birth place and local birth moment. POST (not GET) so the birth date and
    coordinates never appear in a URL or in server access logs."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    date: dt.date
    time: dt.time | None = None  # None = birth time unknown; offset is resolved at noon


class OffsetOption(BaseModel):
    utc_offset_hours: float
    is_dst: bool
    abbreviation: str | None
    label: str  # e.g. "UTC+5", "UTC+5:30"


class TimezoneResponse(BaseModel):
    status: Literal["ok", "ambiguous", "nonexistent", "unknown_zone"]
    tz_name: str | None
    utc_offset_hours: float | None  # set only when status == "ok"
    offsets: list[OffsetOption]  # 1 when ok, 2 when ambiguous (daylight reading first)
    time_assumed: bool


def _label(offset_hours: float) -> str:
    total_minutes = round(abs(offset_hours) * 60)
    hh, mm = divmod(total_minutes, 60)
    sign = "-" if offset_hours < 0 else "+"
    return f"UTC{sign}{hh}" + (f":{mm:02d}" if mm else "")


def _option(c: OffsetCandidate) -> OffsetOption:
    return OffsetOption(
        utc_offset_hours=c.utc_offset_hours,
        is_dst=c.is_dst,
        abbreviation=c.abbreviation,
        label=_label(c.utc_offset_hours),
    )


@router.post("/resolve", response_model=TimezoneResponse)
@limiter.limit("60/minute")
def resolve(request: Request, body: TimezoneRequest) -> TimezoneResponse:
    # Public like the other reference endpoints: it returns only timezone-database
    # facts, and the caller's data is not stored or logged by this route.
    result = resolve_birth_timezone(body.latitude, body.longitude, body.date, body.time)
    return TimezoneResponse(
        status=result.status,
        tz_name=result.tz_name,
        utc_offset_hours=result.utc_offset_hours,
        offsets=[_option(c) for c in result.offsets],
        time_assumed=result.time_assumed,
    )
