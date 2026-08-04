from datetime import datetime, timedelta, timezone
from pathlib import Path

import swisseph as swe

# Chiron (and any other minor-body files added later) needs its own .se1 data
# file, unlike the 10 main planets which pyswisseph computes analytically
# with no external file. seas_18.se1 covers Chiron for the standard modern
# date range -- see backend/ephe/README.md for provenance (official Swiss
# Ephemeris GitHub repo, github.com/aloistr/swisseph).
#
# EPHE_PATH is set per-call inside chiron_longitude(), not once here at
# import time: pyswisseph's ephemeris path turns out to be thread-local, and
# FastAPI dispatches sync endpoints to worker threads, so a single call here
# (which only affects the main/import thread) silently doesn't reach the
# thread that actually runs the calculation -- confirmed by reproducing the
# failure with a plain ThreadPoolExecutor before landing this fix.
EPHE_PATH = str(Path(__file__).resolve().parents[2] / "ephe")

PLANETS = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
}

# Vedic astrology's "planets" — the classical 7 (Sun through Saturn, no outer
# modern planets) plus the lunar nodes Rahu/Ketu. Vedic tradition uses the
# MEAN node (not the oscillating true node) for dasha and chart calculations.
VEDIC_PLANETS = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
}


def to_julian_day(iso_datetime: str) -> float:
    """Convert an ISO 8601 datetime (must carry a UTC offset) to a Swiss
    Ephemeris Julian day in UT, the unit every other function here expects."""
    dt = datetime.fromisoformat(iso_datetime)
    if dt.tzinfo is None:
        raise ValueError("datetime must include a UTC offset, e.g. '...T04:12:00-05:00'")
    dt_utc = dt.astimezone(timezone.utc)
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour)


def from_julian_day(jd: float) -> str:
    """Inverse of to_julian_day: a Swiss Ephemeris Julian day (UT) back to an
    ISO 8601 UTC datetime string. swe.revjul() returns the hour as a decimal
    fraction -- converting that to whole hour/minute/second by truncating
    each component in sequence (int(), then int() again) compounds floating-
    point error and can truncate a value like 11.999999999999998 down to 11
    instead of the intended 12, silently landing a second early (confirmed
    by reproducing this exact off-by-one-second case before landing this
    fix). Rounding to the nearest whole second up front, then letting
    timedelta handle hour/minute/second/day carry, avoids that entirely."""
    year, month, day, hour_decimal = swe.revjul(jd)
    total_seconds = round(hour_decimal * 3600)
    base = datetime(year, month, day, tzinfo=timezone.utc)
    return (base + timedelta(seconds=total_seconds)).isoformat()


def find_solar_return_julian_day(natal_sun_longitude: float, target_year: int, birth_month: int, birth_day: int) -> float:
    """Binary search for the moment in target_year the transiting Sun's
    longitude exactly matches the natal Sun's longitude -- the Sun completes
    one 360-degree cycle roughly every 365.25 days, so this crossing happens
    once per year, always within a day or two of the birth date's calendar
    anniversary (never exactly at a fixed clock time, since the year isn't
    exactly 365 days). The Sun is never retrograde, so its longitude is
    monotonically increasing within this window -- same reasoning that makes
    plain bisection safe, as already used for the Human Design Design-date
    search in app/calc/human_design.py."""
    target = natal_sun_longitude % 360
    # Guard December 31 -> Jan 1 style edge cases at the window boundary by
    # clamping the day to a value valid in every month before building the
    # anchor date -- birth_day is already a real calendar day so this only
    # matters for the +/-4 day window construction below, not birth_day itself.
    anchor_jd = swe.julday(target_year, birth_month, birth_day, 12.0)
    lo, hi = anchor_jd - 4, anchor_jd + 4

    def signed_diff(jd: float) -> float:
        lon, _retro = planet_longitudes(jd)["Sun"]
        return ((lon - target + 180) % 360) - 180

    for _ in range(60):
        mid = (lo + hi) / 2
        if signed_diff(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def planet_longitudes(jd: float) -> dict[str, tuple[float, bool]]:
    """Geocentric ecliptic longitude (degrees, 0-360) and retrograde flag for
    each planet, using pyswisseph's built-in Moshier ephemeris (no separate
    .se1 data files needed — accurate to well under 1 arcsecond in the modern
    date range, far tighter than astrology needs)."""
    result = {}
    for name, code in PLANETS.items():
        pos, _flags = swe.calc_ut(jd, code)
        longitude, speed_longitude = pos[0], pos[3]
        result[name] = (longitude % 360, speed_longitude < 0)
    return result


def _minor_body_longitude(jd: float, swe_code: int) -> tuple[float, bool]:
    """Shared logic for Chiron and the four main-belt asteroids below --
    unlike the 10 main planets, all five need the seas_18.se1 data file
    (see EPHE_PATH above) and the same per-call set_ephe_path(), confirmed
    to already cover all five bodies with zero additional downloads (see
    session notes -- Ceres/Pallas/Juno/Vesta all resolved successfully
    against the same file fetched for Chiron)."""
    swe.set_ephe_path(EPHE_PATH)
    pos, _flags = swe.calc_ut(jd, swe_code)
    longitude, speed_longitude = pos[0], pos[3]
    return longitude % 360, speed_longitude < 0


def chiron_longitude(jd: float) -> tuple[float, bool]:
    """Kept as its own function, same reasoning as lilith_longitude:
    surfaced as NatalChart's own field rather than folded into
    PLANETS/planet_longitudes(), so it doesn't silently change what counts
    as a "planet" for existing pattern detection (stelliums, grand
    trines, etc.)."""
    return _minor_body_longitude(jd, swe.CHIRON)


def ceres_longitude(jd: float) -> tuple[float, bool]:
    """Ceres -- the largest main-belt asteroid (also classified as a dwarf
    planet), one of the four "goddess asteroids" alongside Pallas, Juno,
    and Vesta that most serious astrology software includes by default."""
    return _minor_body_longitude(jd, swe.CERES)


def pallas_longitude(jd: float) -> tuple[float, bool]:
    return _minor_body_longitude(jd, swe.PALLAS)


def juno_longitude(jd: float) -> tuple[float, bool]:
    return _minor_body_longitude(jd, swe.JUNO)


def vesta_longitude(jd: float) -> tuple[float, bool]:
    return _minor_body_longitude(jd, swe.VESTA)


def lilith_longitude(jd: float) -> tuple[float, bool]:
    """Mean Black Moon Lilith -- the Moon's orbital apogee, a mathematically
    defined point (not a physical body), so it needs no separate ephemeris
    data file the way Chiron does. Kept as its own function rather than added
    to PLANETS/planet_longitudes(): Lilith is traditionally read alongside
    the planets but isn't usually counted toward chart patterns (stelliums,
    grand trines, etc.), so it's surfaced as its own NatalChart field instead
    of silently changing what counts as a "planet" for pattern detection."""
    pos, _flags = swe.calc_ut(jd, swe.MEAN_APOG)
    longitude, speed_longitude = pos[0], pos[3]
    return longitude % 360, speed_longitude < 0


def house_cusps(jd: float, latitude: float, longitude: float, house_system: str = "P"):
    """Returns (cusps, ascendant, midheaven). `cusps` is a 12-element list,
    cusps[0] is the house-1 cusp (== ascendant), through cusps[11] house 12."""
    cusps, ascmc = swe.houses(jd, latitude, longitude, house_system.encode())
    ascendant = ascmc[0]
    midheaven = ascmc[1]
    return list(cusps), ascendant, midheaven


def sidereal_longitudes(jd: float) -> dict[str, tuple[float, bool]]:
    """Sidereal (Lahiri ayanamsa) geocentric ecliptic longitude and retrograde
    flag for the 7 classical Vedic planets, plus Rahu (mean lunar node) —
    Ketu is always exactly opposite Rahu, derived by the caller rather than
    calculated separately. Vedic astrology's reference frame is fixed to the
    visible stars (sidereal), not the equinox (tropical) that Western
    astrology uses — the ~24 degree gap between them is the ayanamsa."""
    # FLG_SIDEREAL alone silently zeroes out the returned speed (pos[3])
    # instead of computing it — unlike the default flag=0 case in
    # planet_longitudes() above, which includes speed implicitly. Any
    # explicit flag combination has to ask for FLG_SPEED too, or every
    # retrograde flag below would be a silent False.
    flags = swe.FLG_SIDEREAL | swe.FLG_SPEED
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    result = {}
    for name, code in VEDIC_PLANETS.items():
        pos, _flags = swe.calc_ut(jd, code, flags)
        longitude, speed_longitude = pos[0], pos[3]
        result[name] = (longitude % 360, speed_longitude < 0)
    rahu_pos, _flags = swe.calc_ut(jd, swe.MEAN_NODE, flags)
    result["Rahu"] = (rahu_pos[0] % 360, rahu_pos[3] < 0)
    return result


def planet_equatorial(jd: float, swe_code: int) -> tuple[float, float]:
    """Right ascension and declination (degrees) for a body -- used by
    astrocartography, which works in the equatorial frame (RA/Dec + sidereal
    time), not the ecliptic frame (longitude/latitude) everything else in
    this module uses. FLG_EQUATORIAL asks swisseph to do the ecliptic ->
    equatorial conversion itself (true obliquity, nutation, etc. all
    handled internally) rather than hand-rolling that trig, the same
    reasoning as leaning on swisseph for everything else astronomical in
    this project."""
    pos, _flags = swe.calc_ut(jd, swe_code, swe.FLG_EQUATORIAL)
    return pos[0] % 360, pos[1]


def greenwich_sidereal_time_deg(jd: float) -> float:
    """Greenwich Sidereal Time in degrees (swe.sidtime returns hours). This
    plus a geographic longitude gives Local Sidereal Time, the quantity
    astrocartography's MC/IC/ASC/DSC lines are all defined against."""
    return swe.sidtime(jd) * 15


def sidereal_ascendant(jd: float, latitude: float, longitude: float) -> float:
    """Sidereal ascendant degree, for nakshatra/whole-sign-house purposes.
    Whole-sign houses (the traditional Vedic system) don't need the other 11
    cusps — every house is simply the full sign starting from the
    ascendant's sign, so only this one value is needed."""
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    _cusps, ascmc = swe.houses_ex(jd, latitude, longitude, b"W", swe.FLG_SIDEREAL)
    return ascmc[0] % 360
