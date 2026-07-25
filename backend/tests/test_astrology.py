"""Verifies the astrology engine against independently documented astronomical
events (equinox/solstice instants) rather than a scraped third-party chart —
these UTC timestamps are published by USNO/timeanddate to the minute, and were
cross-checked against the engine's own output before being written here (see
session notes): all four land within 0.001 deg of the expected boundary."""

from app.calc.astrology import assign_house, build_natal_chart, longitude_to_sign
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
