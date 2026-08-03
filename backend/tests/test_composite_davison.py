from app.calc.astrology import build_composite_chart, build_davison_chart, circular_midpoint_deg
from app.calc.models import BirthData, CompositeChartRequest, DavisonChartRequest

PERSON_A = BirthData(datetime="1993-03-14T09:12:00+00:00", latitude=40.7128, longitude=-74.0060)
PERSON_B = BirthData(datetime="1995-07-20T14:30:00+00:00", latitude=51.5074, longitude=-0.1278)


def test_circular_midpoint_handles_the_antimeridian_wrap():
    # Naive arithmetic averaging of 350 and 10 gives 180 -- exactly wrong,
    # the actual midpoint (the shorter arc) is 0.
    assert abs(circular_midpoint_deg(350, 10) % 360) < 1e-6
    assert abs(circular_midpoint_deg(10, 20) - 15) < 1e-6


def test_davison_midpoint_datetime_is_the_true_average_of_the_two_births():
    from app.calc.ephemeris import to_julian_day

    midpoint_datetime, _chart = build_davison_chart(DavisonChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    jd_a = to_julian_day(PERSON_A.datetime)
    jd_b = to_julian_day(PERSON_B.datetime)
    jd_mid = to_julian_day(midpoint_datetime)
    assert abs(jd_mid - (jd_a + jd_b) / 2) < 1e-6


def test_davison_chart_is_a_real_natal_chart_with_its_own_houses():
    _midpoint_datetime, chart = build_davison_chart(DavisonChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    assert chart.ascendant is not None
    assert chart.houses is not None
    assert len(chart.houses) == 12


def test_davison_chart_without_location_has_no_houses():
    a_no_location = PERSON_A.model_copy(update={"latitude": None, "longitude": None})
    _midpoint_datetime, chart = build_davison_chart(DavisonChartRequest(person_a=a_no_location, person_b=PERSON_B))
    assert chart.ascendant is None
    assert chart.houses is None


def test_composite_sun_is_the_circular_midpoint_of_both_natal_suns():
    from app.calc.astrology import build_natal_chart

    chart_a = build_natal_chart(PERSON_A)
    chart_b = build_natal_chart(PERSON_B)
    sun_a = next(p.longitude for p in chart_a.planets if p.name == "Sun")
    sun_b = next(p.longitude for p in chart_b.planets if p.name == "Sun")
    expected = circular_midpoint_deg(sun_a, sun_b)

    composite = build_composite_chart(CompositeChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    composite_sun = next(p.longitude for p in composite.planets if p.name == "Sun")
    assert abs(composite_sun - expected) < 1e-6


def test_composite_planets_are_never_marked_retrograde():
    composite = build_composite_chart(CompositeChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    assert all(p.retrograde is False for p in composite.planets)
    assert composite.lilith.retrograde is False
    assert composite.chiron.retrograde is False


def test_composite_houses_are_exactly_equal_30_degree_wedges_from_ascendant():
    composite = build_composite_chart(CompositeChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    assert composite.houses is not None
    for house in composite.houses:
        expected = (composite.ascendant + (house.house - 1) * 30) % 360
        assert abs(house.longitude - expected) < 1e-6


def test_composite_chart_includes_lilith_and_chiron():
    composite = build_composite_chart(CompositeChartRequest(person_a=PERSON_A, person_b=PERSON_B))
    assert composite.lilith.name == "Lilith"
    assert composite.chiron.name == "Chiron"


def test_composite_chart_includes_all_four_asteroids_as_midpoints():
    from app.calc.astrology import build_natal_chart

    chart_a = build_natal_chart(PERSON_A)
    chart_b = build_natal_chart(PERSON_B)
    composite = build_composite_chart(CompositeChartRequest(person_a=PERSON_A, person_b=PERSON_B))

    for name, natal_attr, composite_placement in [
        ("Ceres", "ceres", composite.ceres),
        ("Pallas", "pallas", composite.pallas),
        ("Juno", "juno", composite.juno),
        ("Vesta", "vesta", composite.vesta),
    ]:
        assert composite_placement.name == name
        assert composite_placement.retrograde is False
        expected = circular_midpoint_deg(getattr(chart_a, natal_attr).longitude, getattr(chart_b, natal_attr).longitude)
        assert abs(composite_placement.longitude - expected) < 1e-6
