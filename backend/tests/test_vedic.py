"""Verifies the Vedic (sidereal) additions: the ayanamsa correction is
self-consistent with Swiss Ephemeris's own reported value (same equinox
timestamps already verified in test_astrology.py's tropical tests), nakshatra
boundaries land where the fixed 13d20m spans say they should, Rahu/Ketu stay
exactly opposite each other, and the Vimshottari dasha sequence/durations
match the fixed traditional table -- all pure arithmetic, independently
checkable without trusting the engine's own output."""

from datetime import datetime, timedelta, timezone

import swisseph as swe

from app.calc.astrology import build_vedic_chart
from app.calc.ephemeris import planet_longitudes, sidereal_longitudes, to_julian_day
from app.calc.models import BirthData
from app.calc.vedic import (
    DASHA_SEQUENCE,
    DASHA_YEARS,
    NAKSHATRA_SPAN,
    current_mahadasha,
    nakshatra_for_longitude,
)

EQUINOX_SOLSTICE_CASES = [
    ("march equinox 2024", "2024-03-20T03:06:00+00:00"),
    ("june solstice 2024", "2024-06-20T20:51:00+00:00"),
    ("september equinox 2024", "2024-09-22T12:44:00+00:00"),
    ("december solstice 2024", "2024-12-21T09:20:00+00:00"),
]


def test_sidereal_offset_matches_swisseph_own_ayanamsa():
    for label, iso_dt in EQUINOX_SOLSTICE_CASES:
        jd = to_julian_day(iso_dt)
        tropical, _retro = planet_longitudes(jd)["Sun"]
        sidereal, _retro2 = sidereal_longitudes(jd)["Sun"]
        offset = (tropical - sidereal) % 360
        expected_ayanamsa = swe.get_ayanamsa_ut(jd)
        assert abs(offset - expected_ayanamsa) < 0.01, f"{label}: offset {offset} vs ayanamsa {expected_ayanamsa}"


def test_nakshatra_boundaries():
    assert nakshatra_for_longitude(0.0) == ("Ashwini", "Ketu", 0.0)
    name, lord, fraction = nakshatra_for_longitude(NAKSHATRA_SPAN / 2)
    assert (name, lord) == ("Ashwini", "Ketu")
    assert abs(fraction - 0.5) < 1e-6
    name2, lord2, fraction2 = nakshatra_for_longitude(NAKSHATRA_SPAN)
    assert (name2, lord2) == ("Bharani", "Venus")
    assert fraction2 < 1e-6
    # last nakshatra (Revati) ends the 27-cycle just before 360
    name3, lord3, _f = nakshatra_for_longitude(359.9)
    assert (name3, lord3) == ("Revati", "Mercury")


def test_rahu_ketu_always_opposite():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7, longitude=-74.0)
    chart = build_vedic_chart(birth)
    rahu = next(p for p in chart.planets if p.name == "Rahu")
    ketu = next(p for p in chart.planets if p.name == "Ketu")
    diff = abs(rahu.longitude - ketu.longitude) % 360
    assert abs(diff - 180) < 1e-6
    assert rahu.retrograde == ketu.retrograde


def test_dasha_sequence_covers_120_years_with_correct_order():
    assert sum(DASHA_YEARS[p] for p in DASHA_SEQUENCE) == 120
    assert DASHA_SEQUENCE == ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]


def test_dasha_first_period_is_full_duration_when_moon_at_nakshatra_start():
    birth_dt = datetime(1990, 1, 1, tzinfo=timezone.utc)
    # Moon at exactly 0 deg -> Ashwini -> Ketu lord, elapsed_fraction 0 ->
    # first Mahadasha should run the full 7 years, no partial shortening.
    just_before_end = birth_dt + timedelta(days=7 * 365.25 - 1)
    result = current_mahadasha(0.0, birth_dt, just_before_end)
    assert result["lord"] == "Ketu"

    just_after_end = birth_dt + timedelta(days=7 * 365.25 + 1)
    result2 = current_mahadasha(0.0, birth_dt, just_after_end)
    assert result2["lord"] == "Venus"  # next in DASHA_SEQUENCE after Ketu


def test_dasha_partial_first_period_when_moon_mid_nakshatra():
    birth_dt = datetime(1990, 1, 1, tzinfo=timezone.utc)
    # Moon halfway through Ashwini (Ketu, 7yr) -> only ~3.5 years of the
    # first period should remain from birth.
    halfway_longitude = NAKSHATRA_SPAN / 2
    just_before = birth_dt + timedelta(days=3.5 * 365.25 - 5)
    just_after = birth_dt + timedelta(days=3.5 * 365.25 + 5)
    assert current_mahadasha(halfway_longitude, birth_dt, just_before)["lord"] == "Ketu"
    assert current_mahadasha(halfway_longitude, birth_dt, just_after)["lord"] == "Venus"


def test_whole_sign_houses_ascendant_sign_is_always_house_one():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7, longitude=-74.0)
    chart = build_vedic_chart(birth)
    asc_sign = chart.ascendant_sign
    for planet in chart.planets:
        if planet.sign == asc_sign:
            assert planet.house == 1


def test_vedic_chart_without_location_has_no_ascendant_but_has_dasha_and_nakshatra():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00")
    chart = build_vedic_chart(birth)
    assert chart.ascendant is None
    assert chart.ascendant_sign is None
    assert chart.ascendant_nakshatra is None
    assert chart.moon_nakshatra is not None
    assert chart.current_mahadasha is not None
    assert all(p.house is None for p in chart.planets)
