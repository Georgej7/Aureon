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
