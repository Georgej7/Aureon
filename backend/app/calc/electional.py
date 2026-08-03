"""Electional favorability scanning -- "is this a good day for X" -- a
genuinely different feature shape from the rest of this backend: everything
else computes a single moment (birth, or right now); this scans a date
range and scores each day.

Deliberately conservative in what it claims: a favorability *signal*
combining two real, well-defined inputs (a numerology Personal Day number,
and whether Mercury is actually retrograde that day -- a real astronomical
fact, not an interpretation), not a single confident "yes, do it this day."
Financial-timing framing needs to stay in "worth considering" territory, not
predictive certainty -- see PROJECT-BRIEF.md's brand-voice rule and the
existing pricing-page disclaimer ("not a substitute for professional
financial... advice"). This module computes real signals; the calling layer
(chat / API response) is responsible for keeping the framing honest.
"""

from datetime import date, timedelta

from app.calc import ephemeris
from app.calc.astrology import moon_phase
from app.calc.numerology import personal_day_number

# Traditional Pythagorean associations for financial/material matters: 8
# (authority, material achievement -- the most direct fit), 4 (structure,
# building something durable), 1 (new beginnings, initiative). This is one
# documented convention, not the only one -- flagged the same way as every
# other judgment call in this codebase (see e.g. karmic_debt_numbers).
FAVORABLE_FINANCIAL_DAY_NUMBERS = {8, 4, 1}


def scan_financial_favorability(birth_date: date, start_date: date, num_days: int) -> list[dict]:
    """One entry per day in [start_date, start_date + num_days). Mercury
    retrograde and Moon phase are checked at 12:00 UTC for that calendar
    day -- a day-level signal, not a to-the-minute election (Mercury
    stations only a few times a year and stays retrograde for ~3 weeks, so
    noon-UTC sampling doesn't miss real station days in practice)."""
    results = []
    for offset in range(num_days):
        target = start_date + timedelta(days=offset)
        pd_number = personal_day_number(birth_date, target)

        target_iso = f"{target.isoformat()}T12:00:00+00:00"
        jd = ephemeris.to_julian_day(target_iso)
        raw = ephemeris.planet_longitudes(jd)
        mercury_longitude, mercury_retrograde = raw["Mercury"]
        sun_longitude, _sun_retro = raw["Sun"]
        moon_longitude, _moon_retro = raw["Moon"]
        phase_name, _angle = moon_phase(sun_longitude, moon_longitude)

        results.append(
            {
                "date": target.isoformat(),
                "personal_day_number": pd_number,
                "favorable_numerology": pd_number in FAVORABLE_FINANCIAL_DAY_NUMBERS,
                "mercury_retrograde": mercury_retrograde,
                "moon_phase": phase_name,
            }
        )
    return results
