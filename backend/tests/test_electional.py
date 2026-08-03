from datetime import date

from app.calc.electional import FAVORABLE_FINANCIAL_DAY_NUMBERS, scan_financial_favorability
from app.calc.ephemeris import planet_longitudes, to_julian_day
from app.calc.numerology import personal_day_number, personal_month_number, personal_year_number


def test_personal_day_cascade_hand_derived():
    # birth date(1990,1,15): month=1,day=6,year(2026->2+0+2+6=10->1)=1
    # Personal Year 2026 = reduce(1+6+1) = 8
    # Personal Month (Aug=8) = reduce(8+8) = reduce(16) = 7
    # Personal Day (Aug 1) = reduce(7+1) = 8
    birth = date(1990, 1, 15)
    assert personal_year_number(birth, 2026) == 8
    assert personal_month_number(birth, 2026, 8) == 7
    assert personal_day_number(birth, date(2026, 8, 1)) == 8


def test_scan_returns_one_entry_per_day_in_range():
    results = scan_financial_favorability(date(1990, 1, 15), date(2026, 8, 1), 10)
    assert len(results) == 10
    assert results[0]["date"] == "2026-08-01"
    assert results[9]["date"] == "2026-08-10"


def test_scan_personal_day_matches_direct_calculation():
    results = scan_financial_favorability(date(1990, 1, 15), date(2026, 8, 1), 1)
    assert results[0]["personal_day_number"] == personal_day_number(date(1990, 1, 15), date(2026, 8, 1))
    assert results[0]["favorable_numerology"] == (results[0]["personal_day_number"] in FAVORABLE_FINANCIAL_DAY_NUMBERS)


def test_scan_mercury_retrograde_matches_independent_ephemeris_lookup():
    # Cross-check against planet_longitudes() directly (already independently
    # verified elsewhere via the equinox tests) rather than trusting
    # electional.py's own wiring of it.
    results = scan_financial_favorability(date(1990, 1, 15), date(2026, 8, 1), 5)
    for entry in results:
        jd = to_julian_day(f"{entry['date']}T12:00:00+00:00")
        _lon, expected_retro = planet_longitudes(jd)["Mercury"]
        assert entry["mercury_retrograde"] == expected_retro


def test_scan_moon_phase_is_a_real_phase_name():
    results = scan_financial_favorability(date(1990, 1, 15), date(2026, 8, 1), 3)
    valid_phases = {
        "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
        "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
    }
    for entry in results:
        assert entry["moon_phase"] in valid_phases
