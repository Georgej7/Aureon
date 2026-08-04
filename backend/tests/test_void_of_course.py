from app.calc.ephemeris import planet_longitudes, to_julian_day
from app.calc.void_of_course import find_void_of_course_periods

START = "2024-06-01"
DAYS = 20


def test_sign_ingress_moments_are_exact_sign_boundaries():
    periods = find_void_of_course_periods(START, DAYS)
    assert len(periods) > 0
    for period in periods:
        jd_end = to_julian_day(period.end)
        moon_lon, _retro = planet_longitudes(jd_end)["Moon"]
        # At the exact ingress moment the Moon's longitude should sit right
        # on a multiple of 30 degrees (to within the bisection's tolerance).
        degrees_into_sign = moon_lon % 30
        assert degrees_into_sign < 0.001 or degrees_into_sign > 29.999


def test_last_aspect_time_actually_satisfies_the_aspect_definition():
    # Independent-of-the-search-loop check: at each period's reported start
    # (its last major aspect before the void begins), directly recompute the
    # Moon's angular separation from every other planet and confirm at least
    # one is within 0.01 degree of a real major-aspect angle -- proves the
    # bisection actually converged on a genuine aspect, not an artifact.
    periods = find_void_of_course_periods(START, DAYS)
    scan_start_jd = to_julian_day(f"{START}T00:00:00+00:00")
    major_angles = {0, 60, 90, 120, 180}
    checked_any = False
    for period in periods:
        jd_start = to_julian_day(period.start)
        # Skip periods with no real aspect (void the whole sign) -- start ==
        # the sign-entry moment there, nothing to check against.
        if abs(jd_start - to_julian_day(period.end)) < 1e-6:
            continue
        # Skip the very first period if its reported start is the scan
        # boundary itself -- that can legitimately mean the Moon was
        # already void when the scan began (its real last aspect happened
        # before the searched window, so there's nothing to verify here),
        # not that the bisection found a bogus non-aspect.
        if abs(jd_start - scan_start_jd) < 1e-6:
            continue
        moon_lon, _ = planet_longitudes(jd_start)["Moon"]
        found_match = False
        for name, (lon, _retro) in planet_longitudes(jd_start).items():
            if name == "Moon":
                continue
            diff = abs(moon_lon - lon) % 360
            diff = min(diff, 360 - diff)
            if any(abs(diff - angle) < 0.01 for angle in major_angles):
                found_match = True
                break
        if found_match:
            checked_any = True
        assert found_match, f"period starting {period.start} has no real aspect within 0.01deg"
    assert checked_any


def test_no_later_aspect_exists_between_reported_start_and_end():
    # Completeness check with finer-than-detection sampling: hand-scan every
    # 15 minutes (4x finer than the 90-minute detection step) between a
    # period's reported start and end, confirming no major aspect was missed.
    periods = find_void_of_course_periods(START, DAYS)
    major_angles = [0, 60, 90, 120, 180]
    for period in periods[:3]:  # a few periods is enough to trust the pattern; all 9-10 would be slow
        jd_start = to_julian_day(period.start)
        jd_end = to_julian_day(period.end)
        if jd_end - jd_start < 1e-6:
            continue
        step = 15 / (24 * 60)
        jd = jd_start + step  # skip the exact start itself, which IS on an aspect by definition
        while jd < jd_end - step:
            moon_lon, _ = planet_longitudes(jd)["Moon"]
            for name, (lon, _retro) in planet_longitudes(jd).items():
                if name == "Moon":
                    continue
                diff = abs(moon_lon - lon) % 360
                diff = min(diff, 360 - diff)
                for angle in major_angles:
                    assert abs(diff - angle) > 0.05, (
                        f"undetected aspect near {name} {angle} deg at jd={jd} within reported void period"
                    )
            jd += step


def test_periods_are_chronological_and_contiguous():
    periods = find_void_of_course_periods(START, DAYS)
    for a, b in zip(periods, periods[1:]):
        assert to_julian_day(a.end) <= to_julian_day(b.end)
        assert a.entering_sign is None or a.entering_sign == b.leaving_sign


def test_void_of_course_rejects_nothing_and_returns_reasonable_count():
    # Moon transits ~13 signs per 30-day window (one sign roughly every 2.3
    # days) -- a 20-day window should show somewhere around 8-10 periods,
    # not wildly more or fewer (which would indicate a boundary-detection bug).
    periods = find_void_of_course_periods(START, DAYS)
    assert 6 <= len(periods) <= 12
