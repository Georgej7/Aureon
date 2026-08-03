from datetime import datetime, timedelta, timezone

from app.calc.astrology import build_progressed_chart
from app.calc.models import BirthData, ProgressedChartRequest


def test_progressed_date_uses_day_for_a_year_exactly():
    birth_dt = datetime(1993, 3, 14, 9, 12, 0, tzinfo=timezone.utc)
    birth = BirthData(datetime=birth_dt.isoformat(), latitude=40.7128, longitude=-74.0060)
    # Constructed so age_years comes out to exactly 30.0, isolating the "day
    # for a year" arithmetic from calendar-leap-year noise.
    target_dt = birth_dt + timedelta(days=30 * 365.25)
    request = ProgressedChartRequest(birth=birth, target_date=target_dt.isoformat())

    progressed_datetime, _chart = build_progressed_chart(request)
    progressed_dt = datetime.fromisoformat(progressed_datetime)
    expected = birth_dt + timedelta(days=30)
    assert abs((progressed_dt - expected).total_seconds()) < 1


def test_progressed_chart_at_birth_matches_natal_chart():
    # Age 0 -> progressed date should equal the birth date itself, and the
    # progressed chart should be identical to a plain natal chart.
    from app.calc.astrology import build_natal_chart

    birth = BirthData(datetime="1993-03-14T09:12:00+00:00", latitude=40.7128, longitude=-74.0060)
    request = ProgressedChartRequest(birth=birth, target_date=birth.datetime)
    progressed_datetime, progressed_chart = build_progressed_chart(request)
    natal_chart = build_natal_chart(birth)

    progressed_sun = next(p for p in progressed_chart.planets if p.name == "Sun")
    natal_sun = next(p for p in natal_chart.planets if p.name == "Sun")
    assert abs(progressed_sun.longitude - natal_sun.longitude) < 1e-6


def test_progressed_moon_has_moved_meaningfully_after_30_years():
    # The Moon moves ~13deg/day, so 30 "progressed days" (age 30) should
    # show real movement from the natal Moon -- unlike the Sun, which barely
    # moves at ~1deg/day over the same 30-day progressed span.
    birth = BirthData(datetime="1993-03-14T09:12:00+00:00", latitude=40.7128, longitude=-74.0060)
    target_dt = datetime.fromisoformat(birth.datetime) + timedelta(days=30 * 365.25)
    request = ProgressedChartRequest(birth=birth, target_date=target_dt.isoformat())
    _progressed_datetime, chart = build_progressed_chart(request)

    from app.calc.astrology import build_natal_chart

    natal_chart = build_natal_chart(birth)
    progressed_moon = next(p for p in chart.planets if p.name == "Moon")
    natal_moon = next(p for p in natal_chart.planets if p.name == "Moon")
    diff = abs(((progressed_moon.longitude - natal_moon.longitude + 180) % 360) - 180)
    # ~30 days of real lunar motion (~13deg/day, wrapping mod 360) lands
    # well clear of natal-to-natal noise -- 15deg is a safe floor regardless
    # of exactly where in its cycle the Moon happens to wrap.
    assert diff > 15


def test_progressed_chart_missing_timezone_is_rejected():
    import pytest

    birth = BirthData(datetime="1993-03-14T09:12:00+00:00", latitude=40.7128, longitude=-74.0060)
    request = ProgressedChartRequest(birth=birth, target_date="2026-03-14T12:00:00")
    with pytest.raises(ValueError):
        build_progressed_chart(request)
