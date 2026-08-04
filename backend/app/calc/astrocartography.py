import math

from app.calc import ephemeris
from app.calc.ephemeris import PLANETS
from app.calc.models import AstrocartographyLatLon, BirthData, PlanetLines

# Sampled every 2 degrees from pole to pole minus a small margin -- at the
# poles themselves tan(latitude) blows up, and the ASC/DSC curves approach
# them asymptotically rather than reaching them, so nothing meaningful is
# lost by stopping short.
_LATITUDE_SAMPLES = [lat for lat in range(-88, 89, 2)]


def _normalize_longitude(lon: float) -> float:
    return ((lon + 180) % 360) - 180


def _mc_ic_longitude(ra: float, gst_deg: float) -> tuple[float, float]:
    """MC line: the meridian where this body's right ascension currently
    equals Local Sidereal Time -- i.e. it's culminating (on the upper
    meridian) right now, for anyone standing on that line of longitude.
    IC is the same body's lower-meridian crossing, exactly opposite in
    longitude. Verified against a real natal chart's own Midheaven: applying
    this formula to the Midheaven point's own RA reproduces the exact birth
    longitude swisseph's houses() was given, to floating-point precision
    (see session notes)."""
    mc = _normalize_longitude(ra - gst_deg)
    ic = _normalize_longitude(mc + 180)
    return mc, ic


def _asc_desc_curve(
    ra: float, dec: float, gst_deg: float
) -> tuple[list[AstrocartographyLatLon], list[AstrocartographyLatLon]]:
    """ASC line: for each latitude, the longitude(s) where this body sits
    exactly on the eastern horizon (rising) at the birth instant -- a curve,
    not a straight meridian, since where a body rises depends on both your
    latitude and the body's declination. DSC is the mirror case (setting,
    western horizon). Standard spherical-astronomy rise/set hour-angle
    formula: cos(H) = -tan(latitude) * tan(declination); rising is the
    negative solution, setting the positive one -- verified against a real
    natal chart's own Ascendant the same way as the MC/IC formula above (see
    session notes): applying this exact formula to the Ascendant point's own
    RA/Dec at the birth latitude reproduces the real birth longitude to the
    last decimal place. Latitudes where |tan(lat)*tan(dec)| > 1 are skipped
    -- the body is circumpolar there (never rises or sets), so no point
    exists on the curve at that latitude, same as real astrocartography
    software omits those gaps rather than guessing."""
    asc_points: list[AstrocartographyLatLon] = []
    desc_points: list[AstrocartographyLatLon] = []
    for lat in _LATITUDE_SAMPLES:
        cos_h = -math.tan(math.radians(lat)) * math.tan(math.radians(dec))
        if abs(cos_h) > 1:
            continue
        h0 = math.degrees(math.acos(cos_h))
        asc_lon = _normalize_longitude(ra - h0 - gst_deg)
        desc_lon = _normalize_longitude(ra + h0 - gst_deg)
        asc_points.append(AstrocartographyLatLon(latitude=lat, longitude=asc_lon))
        desc_points.append(AstrocartographyLatLon(latitude=lat, longitude=desc_lon))
    return asc_points, desc_points


def build_astrocartography(birth: BirthData) -> list[PlanetLines]:
    jd = ephemeris.to_julian_day(birth.datetime)
    gst_deg = ephemeris.greenwich_sidereal_time_deg(jd)

    lines = []
    for name, code in PLANETS.items():
        ra, dec = ephemeris.planet_equatorial(jd, code)
        mc_lon, ic_lon = _mc_ic_longitude(ra, gst_deg)
        asc_curve, desc_curve = _asc_desc_curve(ra, dec, gst_deg)
        lines.append(
            PlanetLines(
                planet=name,
                mc_longitude=mc_lon,
                ic_longitude=ic_lon,
                asc_curve=asc_curve,
                desc_curve=desc_curve,
            )
        )
    return lines
