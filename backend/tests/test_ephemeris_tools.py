from app.calc.astrology import ephemeris_for_date, search_aspect
from app.calc.ephemeris import planet_longitudes, to_julian_day


def test_ephemeris_for_date_uses_noon_ut():
    # Cross-check against a direct swisseph call at the documented noon-UT
    # convention, bypassing ephemeris_for_date's own internals.
    jd_direct = to_julian_day("2000-01-01T12:00:00+00:00")
    expected_sun, _retro = planet_longitudes(jd_direct)["Sun"]

    placements = ephemeris_for_date("2000-01-01")
    sun = next(p for p in placements if p.name == "Sun")
    assert abs(sun.longitude - expected_sun) < 1e-9


def test_ephemeris_for_date_sun_sign_matches_known_calendar_fact():
    # Independently verifiable without any astronomical library: the Sun is
    # in Capricorn from ~Dec 21 to ~Jan 19 every year -- Jan 1 is solidly
    # inside that window regardless of the exact ingress degree that year.
    placements = ephemeris_for_date("2000-01-01")
    sun = next(p for p in placements if p.name == "Sun")
    assert sun.sign == "Capricorn"
    assert sun.house is None  # a plain ephemeris has no location, so no houses


def test_ephemeris_for_date_returns_all_ten_planets():
    placements = ephemeris_for_date("2024-06-15")
    names = {p.name for p in placements}
    assert names == {
        "Sun", "Moon", "Mercury", "Venus", "Mars",
        "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
    }


def test_aspect_search_finds_the_2020_great_conjunction():
    # The Jupiter-Saturn "Great Conjunction" of 2020-12-21 was the closest
    # since 1623 and widely documented/observed -- a real, independently
    # verifiable astronomical event, not a self-consistency check.
    hits, searched_days = search_aspect(
        planet_a="Jupiter", planet_b="Saturn", aspect_type="Conjunction",
        start_date="2020-12-01", days=60,
    )
    assert searched_days == 60
    hit_dates = {h[0] for h in hits}
    assert "2020-12-21" in hit_dates
    # The exact-conjunction day should show a very tight orb, not just
    # barely inside the 8-degree Conjunction orb.
    exact_day = next(h for h in hits if h[0] == "2020-12-21")
    assert exact_day[1] < 0.5


def test_aspect_search_rejects_unknown_planet():
    import pytest

    with pytest.raises(ValueError):
        search_aspect(
            planet_a="Jupiter", planet_b="NotAPlanet", aspect_type="Conjunction",
            start_date="2020-12-01", days=5,
        )


def test_aspect_search_rejects_unknown_aspect_type():
    import pytest

    with pytest.raises(ValueError):
        search_aspect(
            planet_a="Jupiter", planet_b="Saturn", aspect_type="NotAnAspect",
            start_date="2020-12-01", days=5,
        )
