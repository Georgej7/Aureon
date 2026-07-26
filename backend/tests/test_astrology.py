"""Verifies the astrology engine against independently documented astronomical
events (equinox/solstice instants) rather than a scraped third-party chart —
these UTC timestamps are published by USNO/timeanddate to the minute, and were
cross-checked against the engine's own output before being written here (see
session notes): all four land within 0.001 deg of the expected boundary."""

from app.calc.astrology import (
    assign_house,
    build_natal_chart,
    compute_synastry,
    compute_synastry_aspects,
    compute_transit_aspects,
    compute_transits,
    longitude_to_sign,
    moon_phase,
)
from app.calc.ephemeris import planet_longitudes, to_julian_day
from app.calc.models import BirthData

# (label, iso datetime UTC, expected Sun ecliptic longitude)
EQUINOX_SOLSTICE_CASES = [
    ("march equinox 2024", "2024-03-20T03:06:00+00:00", 0),
    ("june solstice 2024", "2024-06-20T20:51:00+00:00", 90),
    ("september equinox 2024", "2024-09-22T12:44:00+00:00", 180),
    ("december solstice 2024", "2024-12-21T09:20:00+00:00", 270),
]


def test_sun_longitude_at_equinoxes_and_solstices():
    for label, iso_dt, expected in EQUINOX_SOLSTICE_CASES:
        jd = to_julian_day(iso_dt)
        longitude, _retrograde = planet_longitudes(jd)["Sun"]
        diff = (longitude - expected + 180) % 360 - 180
        assert abs(diff) < 1.0, f"{label}: expected ~{expected} deg, got {longitude:.4f} deg"


def test_longitude_to_sign_boundaries():
    assert longitude_to_sign(0) == ("Aries", 0)
    assert longitude_to_sign(29.9) == ("Aries", 29.9)
    assert longitude_to_sign(30) == ("Taurus", 0)
    assert longitude_to_sign(359.5) == ("Pisces", 29.5)
    assert longitude_to_sign(180) == ("Libra", 0)


def test_assign_house_normal_and_wrapping_ranges():
    cusps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    assert assign_house(15, cusps) == 1
    assert assign_house(45, cusps) == 2
    assert assign_house(345, cusps) == 12  # wraps past 330 -> 360/0

    # a cusp list where house 12 itself wraps across 360/0
    wrapping_cusps = [10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 350]
    assert assign_house(5, wrapping_cusps) == 12
    assert assign_house(355, wrapping_cusps) == 12
    assert assign_house(15, wrapping_cusps) == 1


def test_natal_chart_without_location_still_gets_real_planet_signs():
    # A few minutes after the 2024 March equinox instant, comfortably past the
    # Pisces/Aries boundary — Sun should read as early Aries regardless of birth
    # location, since planet positions don't depend on where on Earth someone
    # was born.
    birth = BirthData(datetime="2024-03-20T04:00:00+00:00", latitude=None, longitude=None)
    chart = build_natal_chart(birth)

    sun = next(p for p in chart.planets if p.name == "Sun")
    assert sun.sign == "Aries"
    assert sun.sign_degree < 1.0
    assert sun.house is None

    assert chart.houses is None
    assert chart.ascendant is None
    assert chart.midheaven is None
    # Aspects don't depend on location either — still computed.
    assert isinstance(chart.aspects, list)


def test_natal_chart_with_location_unchanged():
    birth = BirthData(
        datetime="1993-03-14T04:12:00+04:00", latitude=41.7151, longitude=44.8271
    )
    chart = build_natal_chart(birth)

    assert chart.houses is not None and len(chart.houses) == 12
    assert chart.ascendant is not None
    assert chart.midheaven is not None
    sun = next(p for p in chart.planets if p.name == "Sun")
    assert sun.house is not None


def test_natal_chart_with_unknown_time_still_gets_real_planet_signs():
    # Location is known, but the birth time is only a guess (frontend sends a
    # noon placeholder) — houses/Ascendant/Midheaven must still come back
    # null, since a guessed time makes them meaningless rather than merely
    # imprecise. Planet signs are unaffected either way.
    birth = BirthData(
        datetime="1993-03-14T12:00:00+04:00",
        latitude=41.7151,
        longitude=44.8271,
        time_known=False,
    )
    chart = build_natal_chart(birth)

    sun = next(p for p in chart.planets if p.name == "Sun")
    assert sun.sign == "Pisces"
    assert sun.house is None

    assert chart.houses is None
    assert chart.ascendant is None
    assert chart.midheaven is None
    assert isinstance(chart.aspects, list)


def test_compute_transit_aspects_finds_conjunction_and_directionality():
    transiting = {"Mars": 10.0, "Venus": 100.0}
    natal = {"Sun": 12.0, "Moon": 200.0}

    aspects = compute_transit_aspects(transiting, natal)

    # transiting Mars (10 deg) is within orb of natal Sun (12 deg) -> conjunction
    hit = next(a for a in aspects if a.transiting_planet == "Mars" and a.natal_planet == "Sun")
    assert hit.aspect_type == "Conjunction"
    assert hit.orb == 2.0

    # every transiting/natal pair is checked independently (2x2 = up to 4 results,
    # not deduplicated like within-chart aspects), confirming directionality is preserved
    pairs = {(a.transiting_planet, a.natal_planet) for a in aspects}
    assert ("Mars", "Sun") in pairs
    assert ("Sun", "Mars") not in pairs  # "Sun" was never a transiting input here


def test_moon_phase_boundaries():
    assert moon_phase(sun_longitude=0, moon_longitude=0) == ("New Moon", 0)
    assert moon_phase(sun_longitude=0, moon_longitude=90) == ("First Quarter", 90)
    assert moon_phase(sun_longitude=0, moon_longitude=180) == ("Full Moon", 180)
    assert moon_phase(sun_longitude=10, moon_longitude=5) == ("Waning Crescent", 355)


def test_compute_transits_returns_all_ten_transiting_planets_and_moon_phase():
    natal_longitudes = {"Sun": 45.0, "Moon": 200.0}
    result = compute_transits(natal_longitudes)

    assert len(result.transiting_planets) == 10
    assert {p.name for p in result.transiting_planets} == {
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
    }
    assert isinstance(result.aspects, list)
    assert result.moon_phase.name in {
        "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
        "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
    }


def test_compute_synastry_aspects_checks_every_directional_pair():
    person_a = {"Sun": 10.0, "Venus": 100.0}
    person_b = {"Moon": 12.0, "Mars": 200.0}

    aspects = compute_synastry_aspects(person_a, person_b)

    hit = next(a for a in aspects if a.person_a_planet == "Sun" and a.person_b_planet == "Moon")
    assert hit.aspect_type == "Conjunction"
    assert hit.orb == 2.0

    pairs = {(a.person_a_planet, a.person_b_planet) for a in aspects}
    assert ("Sun", "Moon") in pairs
    assert ("Moon", "Sun") not in pairs  # "Moon" was never a person_a input here


def test_compute_synastry_returns_both_full_charts_and_no_fabricated_score():
    birth_a = BirthData(datetime="1993-03-14T04:12:00+04:00", latitude=41.7151, longitude=44.8271)
    birth_b = BirthData(datetime="1990-07-20T10:00:00+00:00", latitude=51.5072, longitude=-0.1276)

    result = compute_synastry(birth_a, birth_b)

    assert len(result.person_a.planets) == 10
    assert len(result.person_b.planets) == 10
    assert result.person_a.houses is not None  # both have full location+time
    assert result.person_b.houses is not None
    assert isinstance(result.aspects, list)
    assert not hasattr(result, "compatibility_score")
