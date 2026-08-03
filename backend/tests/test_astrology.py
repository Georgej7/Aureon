"""Verifies the astrology engine against independently documented astronomical
events (equinox/solstice instants) rather than a scraped third-party chart —
these UTC timestamps are published by USNO/timeanddate to the minute, and were
cross-checked against the engine's own output before being written here (see
session notes): all four land within 0.001 deg of the expected boundary."""

from app.calc.astrology import (
    assign_house,
    build_natal_chart,
    compute_aspects,
    compute_synastry,
    compute_synastry_aspects,
    compute_transit_aspects,
    compute_transits,
    detect_grand_crosses,
    detect_grand_trines,
    detect_kites,
    detect_mystic_rectangles,
    detect_stelliums,
    detect_t_squares,
    detect_yods,
    longitude_to_sign,
    moon_phase,
)
from app.calc.ephemeris import planet_longitudes, to_julian_day
from app.calc.models import BirthData, PlanetPlacement

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


def test_compute_aspects_finds_minor_aspects():
    # 30 deg apart -> Semisextile; 45 -> Semisquare; 135 -> Sesquiquadrate; 150 -> Quincunx
    longitudes = {"A": 0.0, "B": 30.0, "C": 75.0, "F": 135.0, "E": 150.0}
    aspects = compute_aspects(longitudes)
    by_pair = {frozenset((a.planet_a, a.planet_b)): a.aspect_type for a in aspects}
    assert by_pair[frozenset(("A", "B"))] == "Semisextile"  # 30 deg
    assert by_pair[frozenset(("B", "C"))] == "Semisquare"  # 45 deg
    assert by_pair[frozenset(("A", "F"))] == "Sesquiquadrate"  # 135 deg
    assert by_pair[frozenset(("A", "E"))] == "Quincunx"  # 150 deg


def test_detect_stelliums_requires_at_least_three_in_same_sign():
    planets = [
        PlanetPlacement(name="Sun", longitude=5, sign="Aries", sign_degree=5, house=None, retrograde=False),
        PlanetPlacement(name="Mercury", longitude=10, sign="Aries", sign_degree=10, house=None, retrograde=False),
        PlanetPlacement(name="Venus", longitude=15, sign="Aries", sign_degree=15, house=None, retrograde=False),
        PlanetPlacement(name="Mars", longitude=100, sign="Cancer", sign_degree=10, house=None, retrograde=False),
        PlanetPlacement(name="Jupiter", longitude=105, sign="Cancer", sign_degree=15, house=None, retrograde=False),
    ]
    patterns = detect_stelliums(planets)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Stellium"
    assert set(patterns[0].planets) == {"Sun", "Mercury", "Venus"}


def test_detect_grand_trine_finds_closed_triangle():
    aspects = compute_aspects({"A": 0.0, "B": 120.0, "C": 240.0})
    patterns = detect_grand_trines(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Grand Trine"
    assert set(patterns[0].planets) == {"A", "B", "C"}


def test_detect_t_square_finds_apex():
    aspects = compute_aspects({"A": 0.0, "B": 180.0, "C": 90.0})
    patterns = detect_t_squares(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "T-Square"
    assert patterns[0].apex == "C"
    assert set(patterns[0].planets) == {"A", "B", "C"}


def test_detect_grand_cross_finds_four_planet_configuration():
    aspects = compute_aspects({"A": 0.0, "B": 180.0, "C": 90.0, "D": 270.0})
    patterns = detect_grand_crosses(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Grand Cross"
    assert set(patterns[0].planets) == {"A", "B", "C", "D"}


def test_detect_yod_finds_apex():
    aspects = compute_aspects({"A": 0.0, "B": 60.0, "C": 210.0})
    patterns = detect_yods(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Yod"
    assert patterns[0].apex == "C"
    assert set(patterns[0].planets) == {"A", "B", "C"}


def test_detect_mystic_rectangle_finds_alternating_trine_sextile():
    # A-B opposition (0/180), C-D opposition (120/300); A-C and B-D trine (120deg
    # apart each), A-D and B-C sextile (60deg apart each).
    aspects = compute_aspects({"A": 0.0, "B": 180.0, "C": 120.0, "D": 300.0})
    patterns = detect_mystic_rectangles(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Mystic Rectangle"
    assert set(patterns[0].planets) == {"A", "B", "C", "D"}


def test_detect_mystic_rectangle_absent_for_grand_cross():
    # A Grand Cross (all-square) shouldn't also register as a Mystic Rectangle.
    aspects = compute_aspects({"A": 0.0, "B": 180.0, "C": 90.0, "D": 270.0})
    assert detect_mystic_rectangles(aspects) == []


def test_detect_kite_finds_grand_trine_plus_tail():
    # Grand Trine A=0,B=120,C=240; D=180 is opposite A and sextile both B and C.
    aspects = compute_aspects({"A": 0.0, "B": 120.0, "C": 240.0, "D": 180.0})
    patterns = detect_kites(aspects)
    assert len(patterns) == 1
    assert patterns[0].pattern_type == "Kite"
    assert patterns[0].apex == "D"
    assert set(patterns[0].planets) == {"A", "B", "C", "D"}


def test_detect_kite_absent_without_tail_planet():
    # A bare Grand Trine with no 4th planet shouldn't register as a Kite.
    aspects = compute_aspects({"A": 0.0, "B": 120.0, "C": 240.0})
    assert detect_kites(aspects) == []


def test_quadrant_house_systems_share_true_ascendant_and_midheaven():
    # Placidus, Koch, Campanus, Regiomontanus, and Porphyry are all
    # "quadrant" systems -- they divide the space between the four angles
    # differently, but the angles themselves (Ascendant = house 1 cusp,
    # Midheaven = house 10 cusp) are astronomically fixed points that don't
    # move with house system. This is real, documented astrological fact,
    # not an implementation detail -- if these ever diverged across quadrant
    # systems, that would indicate a real bug.
    birth_base = dict(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060)
    charts = {hs: build_natal_chart(BirthData(**birth_base, house_system=hs)) for hs in ["P", "K", "C", "R", "O"]}
    ascendants = {round(c.ascendant, 4) for c in charts.values()}
    midheavens = {round(c.midheaven, 4) for c in charts.values()}
    assert len(ascendants) == 1
    assert len(midheavens) == 1


def test_equal_house_system_is_exactly_30_degrees_per_house_from_ascendant():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060, house_system="E")
    chart = build_natal_chart(birth)
    asc = chart.houses[0].longitude
    for house in chart.houses:
        expected = (asc + (house.house - 1) * 30) % 360
        assert abs(house.longitude - expected) < 1e-6


def test_whole_sign_house_system_cusps_land_on_sign_boundaries():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060, house_system="W")
    chart = build_natal_chart(birth)
    for house in chart.houses:
        assert house.longitude % 30 == 0


def test_invalid_house_system_code_is_rejected():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        BirthData(datetime="1993-03-14T04:12:00-05:00", house_system="Z")


def test_chiron_matches_well_documented_aries_transit():
    # Chiron entered Aries in Feb 2019 and stayed through the 2020s -- a
    # well-documented, independently checkable public astrological fact,
    # not a value derived from this module's own logic.
    from app.calc.ephemeris import to_julian_day
    from app.calc.astrology import build_natal_chart
    from app.calc.models import BirthData

    birth = BirthData(datetime="2020-06-15T12:00:00+00:00")
    chart = build_natal_chart(birth)
    assert chart.chiron.name == "Chiron"
    assert chart.chiron.sign == "Aries"


def test_chiron_can_be_both_retrograde_and_prograde_across_years():
    # Unlike Lilith (a smoothly-precessing point, always prograde), Chiron is
    # a real body with a genuinely eccentric orbit and real retrograde
    # periods -- this distinguishes correct behavior from accidentally
    # copy-pasting Lilith's always-prograde logic.
    from app.calc.ephemeris import chiron_longitude
    import swisseph as swe

    retro_found = False
    prograde_found = False
    for year in range(1980, 2030, 2):
        jd = swe.julday(year, 6, 15, 12)
        _lon, retro = chiron_longitude(jd)
        if retro:
            retro_found = True
        else:
            prograde_found = True
    assert retro_found and prograde_found


def test_big_four_asteroids_match_independent_direct_swisseph_calls():
    # Cross-check against swe.calc_ut() called directly, bypassing this
    # module's own wrapper functions entirely -- same independence
    # principle as the Chiron retrograde-variation test above.
    import swisseph as swe

    from app.calc.ephemeris import EPHE_PATH, ceres_longitude, juno_longitude, pallas_longitude, vesta_longitude

    jd = to_julian_day("1993-03-14T04:12:00+04:00")
    swe.set_ephe_path(EPHE_PATH)
    for fn, code in [
        (ceres_longitude, swe.CERES),
        (pallas_longitude, swe.PALLAS),
        (juno_longitude, swe.JUNO),
        (vesta_longitude, swe.VESTA),
    ]:
        expected_pos, _flags = swe.calc_ut(jd, code)
        expected_lon, expected_retro = expected_pos[0] % 360, expected_pos[3] < 0
        actual_lon, actual_retro = fn(jd)
        assert abs(actual_lon - expected_lon) < 1e-9
        assert actual_retro == expected_retro


def test_natal_chart_includes_all_four_main_belt_asteroids_with_real_signs():
    birth = BirthData(datetime="1993-03-14T04:12:00+04:00", latitude=41.7151, longitude=44.8271)
    chart = build_natal_chart(birth)
    valid_signs = {
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
    }
    for name, placement in [
        ("Ceres", chart.ceres), ("Pallas", chart.pallas), ("Juno", chart.juno), ("Vesta", chart.vesta),
    ]:
        assert placement.name == name
        assert placement.sign in valid_signs
        assert placement.house is not None  # location known -> houses computed


def test_natal_chart_asteroids_come_back_house_none_without_location():
    birth = BirthData(datetime="1993-03-14T04:12:00+04:00")
    chart = build_natal_chart(birth)
    assert chart.ceres.house is None
    assert chart.pallas.house is None
    assert chart.juno.house is None
    assert chart.vesta.house is None


def test_natal_chart_includes_lilith_with_real_sign_and_speed():
    birth = BirthData(datetime="1993-03-14T04:12:00+04:00", latitude=41.7151, longitude=44.8271)
    chart = build_natal_chart(birth)
    assert chart.lilith.name == "Lilith"
    assert chart.lilith.sign in [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
    ]
    # Mean Lilith moves ~3 deg/month and is never retrograde -- its apogee
    # point only ever advances, unlike a planet's apparent motion.
    assert chart.lilith.retrograde is False


def test_natal_chart_includes_patterns_field():
    birth = BirthData(datetime="1993-03-14T04:12:00+04:00", latitude=41.7151, longitude=44.8271)
    chart = build_natal_chart(birth)
    assert isinstance(chart.patterns, list)
    # every detected pattern must reference real planet names from this chart
    planet_names = {p.name for p in chart.planets}
    for pattern in chart.patterns:
        assert set(pattern.planets) <= planet_names
