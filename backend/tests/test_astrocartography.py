import math

import swisseph as swe

from app.calc.astrocartography import build_astrocartography
from app.calc.ephemeris import greenwich_sidereal_time_deg, house_cusps, to_julian_day
from app.calc.models import BirthData

BIRTH = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060)


def test_mc_line_formula_recovers_the_real_natal_midheaven_longitude():
    # Independent cross-check, not self-consistency: swisseph's houses()
    # already computes the real Midheaven for this birth (trusted elsewhere
    # in this codebase). The Midheaven is *defined* as the ecliptic point
    # whose right ascension currently equals Local Sidereal Time at the
    # birth location -- so applying astrocartography's own MC-line formula
    # to that point's RA must reproduce the exact birth longitude, if the
    # formula (and the sidereal-time/RA machinery under it) is correct.
    jd = to_julian_day(BIRTH.datetime)
    _cusps, _ascendant, midheaven = house_cusps(jd, BIRTH.latitude, BIRTH.longitude)
    gst_deg = greenwich_sidereal_time_deg(jd)

    eps, _flags = swe.calc_ut(jd, swe.ECL_NUT)
    obliquity = eps[0]
    ra_mc = swe.cotrans([midheaven, 0.0, 1.0], -obliquity)[0] % 360

    recovered_longitude = ((ra_mc - gst_deg + 180) % 360) - 180
    assert abs(recovered_longitude - BIRTH.longitude) < 1e-6


def test_asc_line_formula_recovers_the_real_natal_ascendant_longitude():
    # Same idea as the MC test above, for the rising (ASC) rather than
    # culminating (MC) case -- the harder of the two formulas, since it's a
    # curve (latitude-dependent), not a fixed meridian.
    jd = to_julian_day(BIRTH.datetime)
    _cusps, ascendant, _midheaven = house_cusps(jd, BIRTH.latitude, BIRTH.longitude)
    gst_deg = greenwich_sidereal_time_deg(jd)

    eps, _flags = swe.calc_ut(jd, swe.ECL_NUT)
    obliquity = eps[0]
    ra_asc, dec_asc, _dist = swe.cotrans([ascendant, 0.0, 1.0], -obliquity)

    cos_h = -math.tan(math.radians(BIRTH.latitude)) * math.tan(math.radians(dec_asc))
    h0 = math.degrees(math.acos(max(-1, min(1, cos_h))))
    recovered_longitude = ((ra_asc - h0 - gst_deg + 180) % 360) - 180
    assert abs(recovered_longitude - BIRTH.longitude) < 1e-6


def test_build_astrocartography_covers_all_ten_planets():
    lines = build_astrocartography(BIRTH)
    names = {line.planet for line in lines}
    assert names == {
        "Sun", "Moon", "Mercury", "Venus", "Mars",
        "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
    }


def test_ic_line_is_exactly_opposite_the_mc_line():
    lines = build_astrocartography(BIRTH)
    sun_line = next(line for line in lines if line.planet == "Sun")
    diff = abs(((sun_line.mc_longitude - sun_line.ic_longitude + 180) % 360) - 180)
    assert abs(diff - 180) < 1e-9


def test_asc_curve_skips_latitudes_where_the_body_is_circumpolar():
    # Direct test of the underlying formula with a controlled declination
    # (20 degrees) rather than a real planet's ambiguous declination on a
    # specific date: at latitude 80, tan(80)*tan(20) > 1, so the body never
    # rises or sets there (circumpolar) -- the curve must have no point at
    # that latitude, not a fabricated one.
    from app.calc.astrocartography import _asc_desc_curve

    asc_curve, desc_curve = _asc_desc_curve(ra=0.0, dec=20.0, gst_deg=0.0)
    sampled_latitudes = {p.latitude for p in asc_curve}
    assert 80 not in sampled_latitudes
    assert len(desc_curve) == len(asc_curve)
    # But at a latitude well within range, the body does rise/set daily.
    assert 10 in sampled_latitudes
