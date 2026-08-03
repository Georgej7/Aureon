from app.calc.astrology import build_solar_return_chart
from app.calc.ephemeris import from_julian_day, planet_longitudes, to_julian_day
from app.calc.models import BirthData, SolarReturnRequest


def test_julian_day_round_trip_is_exact_to_the_second():
    # Regression case for a real bug: naive truncation of swe.revjul()'s
    # decimal-hour output compounded floating-point error and silently
    # landed one second early (09:11:59 instead of 09:12:00).
    iso = "1993-03-14T04:12:00-05:00"
    jd = to_julian_day(iso)
    assert from_julian_day(jd) == "1993-03-14T09:12:00+00:00"


def test_julian_day_round_trip_handles_second_rollover():
    iso = "2000-06-30T23:59:59+00:00"
    jd = to_julian_day(iso)
    assert from_julian_day(jd) == "2000-06-30T23:59:59+00:00"


def test_solar_return_sun_matches_natal_sun_to_high_precision():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060)
    request = SolarReturnRequest(birth=birth, target_year=2026)
    exact_datetime, chart = build_solar_return_chart(request)

    natal_jd = to_julian_day(birth.datetime)
    natal_sun_longitude, _retro = planet_longitudes(natal_jd)["Sun"]
    return_sun = next(p for p in chart.planets if p.name == "Sun")
    assert abs(return_sun.longitude - natal_sun_longitude) < 1e-4

    # the exact return moment must fall near the calendar birthday in the
    # target year, not drift to some unrelated date
    assert exact_datetime.startswith("2026-03-1")


def test_solar_return_defaults_to_birth_location_when_none_given():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060)
    request = SolarReturnRequest(birth=birth, target_year=2026)
    _exact_datetime, chart = build_solar_return_chart(request)
    assert chart.ascendant is not None  # houses computed => a location was actually used


def test_solar_return_relocated_uses_the_given_location_not_birth_location():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7128, longitude=-74.0060)
    request_ny = SolarReturnRequest(birth=birth, target_year=2026)
    request_tokyo = SolarReturnRequest(birth=birth, target_year=2026, latitude=35.6762, longitude=139.6503)
    _dt_ny, chart_ny = build_solar_return_chart(request_ny)
    _dt_tokyo, chart_tokyo = build_solar_return_chart(request_tokyo)
    # Same exact instant in time (location doesn't change *when* the Sun
    # returns to its natal degree), but a different Ascendant, since houses
    # depend on where you are, not just when it is.
    assert chart_ny.ascendant != chart_tokyo.ascendant
