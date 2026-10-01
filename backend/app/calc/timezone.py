"""Historically correct UTC offset for a birth place and local birth moment.

A natal chart is only as right as the UTC instant it is computed for, and the
instant is local time minus the offset in force at that place on that date.
That offset is not something a person can be expected to know: daylight saving
rules changed repeatedly (Tbilisi was on UTC+5 in May 1999, not +4), countries
moved zones, and the same city had different offsets in different decades. So
the offset is derived here from the birth coordinates and the local date/time
using the IANA timezone database, and the client is told exactly what was
derived (zone name, whether DST applied) so it can be shown to the user.

Two local times have no single answer and are reported, never guessed:
  * ambiguous    - clocks were turned back, so the wall-clock time happened
                   twice (two valid offsets; the user must say which).
  * nonexistent  - clocks were turned forward, so that wall-clock time never
                   happened (the time entered cannot be right).
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from timezonefinder import TimezoneFinder

# Offsets are reported in hours rounded to the minute: real zones have offsets
# like +5:30, +5:45 and (historically) odd values like +5:53:20, and a minute is
# far finer than the chart can resolve (the Moon moves ~0.5 degrees per hour).
Status = Literal["ok", "ambiguous", "nonexistent", "unknown_zone"]

# When the user gives no birth time the app computes at noon; resolve the
# offset at noon too so the two agree.
NOON = time(12, 0)


@dataclass(frozen=True)
class OffsetCandidate:
    utc_offset_hours: float
    is_dst: bool
    abbreviation: str | None


@dataclass(frozen=True)
class TimezoneResolution:
    status: Status
    tz_name: str | None
    offsets: tuple[OffsetCandidate, ...]  # 1 when ok, 2 when ambiguous, 0 otherwise
    time_assumed: bool  # True when no birth time was given and noon was used

    @property
    def utc_offset_hours(self) -> float | None:
        return self.offsets[0].utc_offset_hours if self.status == "ok" else None


@lru_cache(maxsize=1)
def _finder() -> TimezoneFinder:
    # Built once: loading the boundary dataset is the expensive part.
    return TimezoneFinder()


def _hours(delta) -> float:
    return round(delta.total_seconds() / 60) / 60


def _candidate(dt: datetime) -> OffsetCandidate:
    return OffsetCandidate(
        utc_offset_hours=_hours(dt.utcoffset()),
        is_dst=bool(dt.dst()),
        abbreviation=dt.tzname(),
    )


def _is_real(dt: datetime, tz: ZoneInfo) -> bool:
    """A local time is real iff converting to UTC and back returns the same wall clock."""
    return dt.astimezone(timezone.utc).astimezone(tz).replace(tzinfo=None) == dt.replace(tzinfo=None)


def resolve_offset_for_zone(tz_name: str, local_date: date, local_time: time | None) -> TimezoneResolution:
    """Offset in force in IANA zone `tz_name` at the given local date/time."""
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return TimezoneResolution("unknown_zone", tz_name, (), local_time is None)

    time_assumed = local_time is None
    naive = datetime.combine(local_date, NOON if time_assumed else local_time)
    first = naive.replace(tzinfo=tz, fold=0)
    second = naive.replace(tzinfo=tz, fold=1)

    if first.utcoffset() == second.utcoffset():
        return TimezoneResolution("ok", tz_name, (_candidate(first),), time_assumed)

    # Offsets differ between fold=0 and fold=1 only inside a clock change.
    if _is_real(first, tz) and _is_real(second, tz):
        # Fall-back overlap: both readings are real. Order by offset, later UTC first
        # (the daylight reading comes first on the wall clock).
        ordered = sorted((_candidate(first), _candidate(second)), key=lambda c: -c.utc_offset_hours)
        return TimezoneResolution("ambiguous", tz_name, tuple(ordered), time_assumed)
    return TimezoneResolution("nonexistent", tz_name, (), time_assumed)


def resolve_birth_timezone(
    latitude: float, longitude: float, local_date: date, local_time: time | None
) -> TimezoneResolution:
    """Zone at the coordinates, then the offset in force there on that local date/time."""
    tz_name = _finder().timezone_at(lat=latitude, lng=longitude)
    if tz_name is None:
        return TimezoneResolution("unknown_zone", None, (), local_time is None)
    return resolve_offset_for_zone(tz_name, local_date, local_time)
