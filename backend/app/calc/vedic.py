"""Nakshatra assignment and Vimshottari Mahadasha calculation — both pure
arithmetic on the sidereal Moon longitude, no separate ephemeris lookups
beyond what ephemeris.py already provides. Kept as its own module since these
are Vedic-specific concepts with no Western-astrology equivalent, distinct
from the sign/house/aspect logic in astrology.py.
"""

from datetime import datetime, timedelta

NAKSHATRA_SPAN = 360 / 27  # 13 degrees 20 minutes

# The 27 nakshatras in ecliptic order (sidereal, starting at 0 degrees Aries),
# each paired with its Vimshottari dasha-lord. The 9-planet lord sequence
# below repeats exactly 3 times across the 27 nakshatras — that repetition
# is fixed tradition, not a coincidence of this table.
NAKSHATRAS = [
    ("Ashwini", "Ketu"),
    ("Bharani", "Venus"),
    ("Krittika", "Sun"),
    ("Rohini", "Moon"),
    ("Mrigashira", "Mars"),
    ("Ardra", "Rahu"),
    ("Punarvasu", "Jupiter"),
    ("Pushya", "Saturn"),
    ("Ashlesha", "Mercury"),
    ("Magha", "Ketu"),
    ("Purva Phalguni", "Venus"),
    ("Uttara Phalguni", "Sun"),
    ("Hasta", "Moon"),
    ("Chitra", "Mars"),
    ("Swati", "Rahu"),
    ("Vishakha", "Jupiter"),
    ("Anuradha", "Saturn"),
    ("Jyeshtha", "Mercury"),
    ("Mula", "Ketu"),
    ("Purva Ashadha", "Venus"),
    ("Uttara Ashadha", "Sun"),
    ("Shravana", "Moon"),
    ("Dhanishta", "Mars"),
    ("Shatabhisha", "Rahu"),
    ("Purva Bhadrapada", "Jupiter"),
    ("Uttara Bhadrapada", "Saturn"),
    ("Revati", "Mercury"),
]

# Fixed 9-planet Vimshottari sequence (the order dasha periods always cycle
# through, regardless of which one starts the sequence) and each one's
# share of the 120-year total cycle.
DASHA_SEQUENCE = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {
    "Ketu": 7,
    "Venus": 20,
    "Sun": 6,
    "Moon": 10,
    "Mars": 7,
    "Rahu": 18,
    "Jupiter": 16,
    "Saturn": 19,
    "Mercury": 17,
}
DASHA_CYCLE_YEARS = sum(DASHA_YEARS.values())  # 120
YEAR_DAYS = 365.25  # civil-year approximation, standard in Vimshottari practice


def nakshatra_for_longitude(sidereal_longitude: float) -> tuple[str, str, float]:
    """Returns (nakshatra name, ruling planet, elapsed fraction 0-1 through
    that nakshatra) for a sidereal ecliptic longitude."""
    normalized = sidereal_longitude % 360
    index = int(normalized // NAKSHATRA_SPAN) % 27
    name, lord = NAKSHATRAS[index]
    position_within = normalized - index * NAKSHATRA_SPAN
    elapsed_fraction = position_within / NAKSHATRA_SPAN
    return name, lord, elapsed_fraction


def current_mahadasha(
    moon_sidereal_longitude: float, birth_datetime: datetime, as_of: datetime
) -> dict:
    """Walks the Vimshottari sequence forward from birth to find which
    Mahadasha (major planetary period) covers `as_of`. The first period after
    birth is a partial one — however much of the birth nakshatra's ruling
    planet's full duration was still unelapsed at the moment of birth."""
    _name, birth_lord, elapsed_fraction = nakshatra_for_longitude(moon_sidereal_longitude)

    start_index = DASHA_SEQUENCE.index(birth_lord)
    first_period_years = DASHA_YEARS[birth_lord] * (1 - elapsed_fraction)

    cursor = birth_datetime
    lord = birth_lord
    duration_years = first_period_years
    sequence_position = start_index

    # One full 120-year cycle from birth comfortably covers a human lifespan;
    # loop the 9-planet sequence again in the unlikely event it doesn't.
    for _ in range(len(DASHA_SEQUENCE) * 4):
        period_end = cursor + timedelta(days=duration_years * YEAR_DAYS)
        if cursor <= as_of < period_end:
            return {
                "lord": lord,
                "start": cursor.isoformat(),
                "end": period_end.isoformat(),
            }
        cursor = period_end
        sequence_position = (sequence_position + 1) % len(DASHA_SEQUENCE)
        lord = DASHA_SEQUENCE[sequence_position]
        duration_years = DASHA_YEARS[lord]

    # as_of is implausibly far in the future (past several lifetimes) --
    # return the last computed period rather than raising.
    return {"lord": lord, "start": cursor.isoformat(), "end": period_end.isoformat()}
