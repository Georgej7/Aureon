from datetime import datetime, timezone

import swisseph as swe

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


def sidereal_ascendant(jd: float, latitude: float, longitude: float) -> float:
    """Sidereal ascendant degree, for nakshatra/whole-sign-house purposes.
    Whole-sign houses (the traditional Vedic system) don't need the other 11
    cusps — every house is simply the full sign starting from the
    ascendant's sign, so only this one value is needed."""
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    _cusps, ascmc = swe.houses_ex(jd, latitude, longitude, b"W", swe.FLG_SIDEREAL)
    return ascmc[0] % 360
