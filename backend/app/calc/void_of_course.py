from app.calc import ephemeris
from app.calc.astrology import ASPECT_DEFINITIONS
from app.calc.ephemeris import PLANETS
from app.calc.models import VoidOfCoursePeriod

# Traditional void-of-course only considers the 5 Ptolemaic (major) aspects.
# ASPECT_DEFINITIONS is ordered by increasing angle (0, 30, 45, 60, 90, 120,
# 135, 150, 180), not grouped major-then-minor -- a plain [:5] slice
# silently pulled in Semisextile/Semisquare (minor) while dropping Trine/
# Opposition (major) entirely, caught by a test asserting the found "last
# aspect" moment actually satisfies a real major-aspect angle when it
# didn't. Filtering by name is unambiguous regardless of list order.
_MAJOR_ASPECT_NAMES = {"Conjunction", "Sextile", "Square", "Trine", "Opposition"}
_MAJOR_ASPECTS = [d for d in ASPECT_DEFINITIONS if d[0] in _MAJOR_ASPECT_NAMES]
_OTHER_PLANETS = [name for name in PLANETS if name != "Moon"]

# Each aspect can form from either side (a Square is 90 degrees either
# direction) -- expanded into explicit signed target degrees for
# (moon_lon - other_lon) mod 360 so the crossing-detection below can use a
# genuine sign change rather than a folded "shortest arc" comparison. That
# folded approach (the first version of this module) collapses to
# min(diff, 360-diff), a value confined to [0, 180] -- for Conjunction
# (target 0) and Opposition (target 180), the target sits at the very edge
# of that range, so the difference only ever touches zero at an extremum
# and never actually changes sign. A real Moon-Mars conjunction was
# confirmed to slip through undetected this way in testing (diff dipped to
# 0.014 degrees and back up without ever going negative) -- this isn't a
# resolution problem, it's structural, and no amount of finer sampling
# would have caught it. 0 and 180 are self-mirrored (360-0=0, 360-180=180
# mod 360) so only get one target each; the others get two.
_ASPECT_TARGETS: list[tuple[str, float]] = []
for _name, _angle, _orb in _MAJOR_ASPECTS:
    _ASPECT_TARGETS.append((_name, _angle % 360))
    _mirror = (360 - _angle) % 360
    if _mirror != _angle % 360:
        _ASPECT_TARGETS.append((_name, _mirror))

# Sign transits take roughly 2-2.7 days (Moon's speed varies 11.8-15.4
# deg/day across its elliptical orbit) -- 4 days is a safe upper bound with
# margin, used only to cap the bisection search window, not as a claimed
# transit duration.
_MAX_SIGN_TRANSIT_DAYS = 4.0
# Sampling interval for detecting aspect-crossing brackets within a sign
# transit. The fastest-changing relative angle in this comparison is
# dominated by the Moon's own motion (~0.5deg/hour) -- 90 minutes keeps
# comfortably more than one sample per degree of relative motion, so a
# crossing can't hide between two samples.
_SCAN_STEP_DAYS = 1.5 / 24


def _moon_sign_index(jd: float) -> int:
    lon, _retro = ephemeris.planet_longitudes(jd)["Moon"]
    return int(lon // 30) % 12


def _find_sign_ingress(jd_start: float) -> float:
    """Bisects forward for the exact JD the Moon next crosses a sign
    boundary. The Moon is never retrograde, so its sign index is
    monotonically non-decreasing (mod 12) over any window shorter than a
    full lunar month -- safe to bisect the same way build_solar_return_chart
    already bisects the Sun's (also always-direct) motion."""
    start_sign = _moon_sign_index(jd_start)
    lo, hi = jd_start, jd_start + _MAX_SIGN_TRANSIT_DAYS
    # Confirm hi is actually past the boundary before bisecting.
    while _moon_sign_index(hi) == start_sign:
        hi += _MAX_SIGN_TRANSIT_DAYS
    # 25 halvings of a <=4-day bracket resolves to well under a second --
    # far tighter than a void-of-course report needs (minute-level is
    # already more than any astrologer reads this to), and a fraction of
    # the 60 iterations used elsewhere in this codebase for charts that
    # genuinely want that much headroom.
    for _ in range(25):
        mid = (lo + hi) / 2
        if _moon_sign_index(mid) == start_sign:
            lo = mid
        else:
            hi = mid
    # Returning hi, not the midpoint: the loop invariant guarantees
    # _moon_sign_index(hi) is always the NEW sign, while (lo+hi)/2 has no
    # such guarantee -- it can land on either side of the true boundary by
    # a razor-thin margin, and did in testing (359.9999995 degrees, still
    # technically the old sign, off by under a millionth of a degree but
    # enough to make the caller misclassify which sign was entered).
    return hi


def _signed_diff(moon_lon: float, other_lon: float, target_deg: float) -> float:
    """(moon_lon - other_lon), wrapped to (-180, 180] around target_deg --
    a genuine sign-changing root-finding target: it crosses zero exactly
    once, smoothly, at the instant the raw longitude difference passes
    through target_deg, regardless of where target_deg falls (including 0
    or 180, unlike the folded shortest-arc approach this replaced)."""
    raw = (moon_lon - other_lon) % 360
    return ((raw - target_deg + 180) % 360) - 180


def _signed_diff_from_longitudes(
    longitudes: dict[str, tuple[float, bool]], other_planet: str, target_deg: float
) -> float:
    """Same as _signed_diff, but pulls both longitudes out of an
    already-computed planet_longitudes() result -- used by the coarse scan,
    which shares one such dict across all target checks at that instant
    instead of recomputing it repeatedly."""
    return _signed_diff(longitudes["Moon"][0], longitudes[other_planet][0], target_deg)


def _find_last_aspect_before(jd_window_start: float, jd_window_end: float) -> float | None:
    """Scans [start, end) for every Moon-to-other-planet major-aspect exact
    crossing, returning the latest one -- or None if the Moon makes no more
    major aspects before leaving the sign (a real, if less common, case:
    "void of course the whole sign"). Samples planet_longitudes() once per
    time step and reuses it across all 45 (planet, aspect) combinations --
    computing it fresh per combination (the first version of this function)
    made this ~45x slower than necessary and risked timing out as a live
    endpoint."""
    samples: list[tuple[float, dict[str, tuple[float, bool]]]] = []
    jd = jd_window_start
    while True:
        samples.append((jd, ephemeris.planet_longitudes(jd)))
        if jd >= jd_window_end:
            break
        jd = min(jd + _SCAN_STEP_DAYS, jd_window_end)

    latest: float | None = None
    for planet in _OTHER_PLANETS:
        for _name, target_deg in _ASPECT_TARGETS:
            for (jd_a, long_a), (jd_b, long_b) in zip(samples, samples[1:]):
                val_a = _signed_diff_from_longitudes(long_a, planet, target_deg)
                val_b = _signed_diff_from_longitudes(long_b, planet, target_deg)
                if val_a == 0 or (val_a < 0) != (val_b < 0):
                    lo, hi, lo_val = jd_a, jd_b, val_a
                    # 22 halvings of a <=90-minute bracket resolves to a few
                    # milliseconds -- minute-level would already be enough.
                    for _ in range(22):
                        mid = (lo + hi) / 2
                        moon_lon, other_lon = ephemeris.two_planet_longitudes(mid, "Moon", planet)
                        mid_val = _signed_diff(moon_lon, other_lon, target_deg)
                        if (mid_val < 0) == (lo_val < 0):
                            lo, lo_val = mid, mid_val
                        else:
                            hi = mid
                    crossing = (lo + hi) / 2
                    # _signed_diff wraps at raw = target_deg + 180 (its own
                    # sawtooth reset, not a real aspect) -- if two adjacent
                    # samples happen to straddle that reset instead of a
                    # genuine zero-crossing, they'd also show opposite
                    # signs, but bisecting a discontinuity converges to
                    # nonsense near +/-180, not zero. Confirming the
                    # converged value is actually near zero rejects that
                    # rare false-bracket case rather than recording it as a
                    # real aspect.
                    moon_lon, other_lon = ephemeris.two_planet_longitudes(crossing, "Moon", planet)
                    if abs(_signed_diff(moon_lon, other_lon, target_deg)) > 0.01:
                        continue
                    if latest is None or crossing > latest:
                        latest = crossing
    return latest


def find_void_of_course_periods(start_date: str, days: int) -> list[VoidOfCoursePeriod]:
    jd_cursor = ephemeris.to_julian_day(f"{start_date}T00:00:00+00:00")
    jd_scan_end = jd_cursor + days

    periods: list[VoidOfCoursePeriod] = []
    while jd_cursor < jd_scan_end:
        sign_end_jd = _find_sign_ingress(jd_cursor)
        window_end = min(sign_end_jd, jd_scan_end)
        last_aspect_jd = _find_last_aspect_before(jd_cursor, window_end)
        void_start_jd = last_aspect_jd if last_aspect_jd is not None else jd_cursor

        entering_sign_index = _moon_sign_index(sign_end_jd) if sign_end_jd <= jd_scan_end else None
        periods.append(
            VoidOfCoursePeriod(
                start=ephemeris.from_julian_day(void_start_jd),
                end=ephemeris.from_julian_day(sign_end_jd),
                leaving_sign=_SIGN_NAMES[_moon_sign_index(jd_cursor)],
                entering_sign=_SIGN_NAMES[entering_sign_index] if entering_sign_index is not None else None,
            )
        )
        jd_cursor = sign_end_jd
    return periods


_SIGN_NAMES = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]
