"""Nakshatra assignment and Vimshottari Mahadasha calculation — both pure
arithmetic on the sidereal Moon longitude, no separate ephemeris lookups
beyond what ephemeris.py already provides. Kept as its own module since these
are Vedic-specific concepts with no Western-astrology equivalent, distinct
from the sign/house/aspect logic in astrology.py.
"""

from datetime import datetime, timedelta

# Duplicated from astrology.py's SIGNS rather than imported, to avoid a
# circular import (astrology.py already imports from this module).
SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

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


def navamsa_sign(sidereal_longitude: float) -> str:
    """D9 (Navamsa) sign for a sidereal longitude -- each sign divides into 9
    navamsas of 3d20' each. Uses the standard computational shortcut that's
    mathematically equivalent to the traditional movable/fixed/dual-sign
    counting rule: navamsa sign index = (sign_index * 9 + pada_index) mod 12,
    where pada_index (0-8) is which of the 9 navamsa slices the longitude
    falls in within its own sign."""
    normalized = sidereal_longitude % 360
    sign_index = int(normalized // 30)
    degree_in_sign = normalized - sign_index * 30
    pada_index = int(degree_in_sign // (30 / 9))
    navamsa_index = (sign_index * 9 + pada_index) % 12
    return SIGNS[navamsa_index]


# Traditional Vedic sign rulerships -- the 7 classical planets only (no
# Uranus/Neptune/Pluto, which Vedic astrology doesn't use as rulers; Scorpio
# stays ruled by Mars and Aquarius/Pisces by Saturn/Jupiter, not the modern
# Western reassignments to the outer planets).
SIGN_LORDS = {
    "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
    "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
    "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter",
}

KENDRA_HOUSES = (1, 4, 7, 10)
TRIKONA_HOUSES = (1, 5, 9)


def house_lord(house_num: int, ascendant_sign_index: int) -> str:
    """Whole-sign house lordship: which planet rules the sign occupying a
    given house, counted from the ascendant -- same whole-sign convention
    already used for planet.house in astrology.py's build_vedic_chart."""
    sign_index = (ascendant_sign_index + house_num - 1) % 12
    return SIGN_LORDS[SIGNS[sign_index]]


def detect_house_lordship_yogas(
    sign_of: dict[str, int], ascendant_sign_index: int
) -> list[tuple[str, list[str]]]:
    """Raj Yoga and Dhana Yoga -- unlike Gaja Kesari/Chandra-Mangal/Budhaditya
    above, these need a known ascendant (birth time + location), since
    they're about which planet *rules* a house, not just where planets sit
    relative to each other. Classical yoga theory has many recognized
    variants of each; these are the most commonly cited core definitions
    (Brihat Parashara Hora Shastra), not an exhaustive list.

    - Raj Yoga: a kendra-house lord (1st/4th/7th/10th) and a trikona-house
      lord (1st/5th/9th) are connected -- either the same planet rules both
      (a "yogakaraka"), they sit conjunct in the same sign, or they mutually
      exchange signs (parivartana).
    - Dhana Yoga: the 2nd-house lord (wealth) and 11th-house lord (gains)
      are connected the same way -- conjunction or exchange.
    """
    yogas: list[tuple[str, list[str]]] = []

    def is_conjunct_or_exchanged(lord_a: str, lord_b: str) -> bool:
        if lord_a not in sign_of or lord_b not in sign_of:
            return False
        if sign_of[lord_a] == sign_of[lord_b]:
            return True  # conjunction
        # parivartana: each lord sits in the sign the other one rules
        sign_a_ruled_by_b = SIGN_LORDS[SIGNS[sign_of[lord_a]]] == lord_b
        sign_b_ruled_by_a = SIGN_LORDS[SIGNS[sign_of[lord_b]]] == lord_a
        return sign_a_ruled_by_b and sign_b_ruled_by_a

    kendra_lords = {h: house_lord(h, ascendant_sign_index) for h in KENDRA_HOUSES}
    trikona_lords = {h: house_lord(h, ascendant_sign_index) for h in TRIKONA_HOUSES}

    seen_raj: set[frozenset[str]] = set()
    for kh, klord in kendra_lords.items():
        for th, tlord in trikona_lords.items():
            if kh == th:
                continue  # house 1 is both kendra and trikona -- comparing it to itself isn't a real yoga
            if klord == tlord:
                key = frozenset({klord})
                if key not in seen_raj:
                    seen_raj.add(key)
                    yogas.append(("Raj Yoga", [klord]))
            elif is_conjunct_or_exchanged(klord, tlord):
                key = frozenset({klord, tlord})
                if key not in seen_raj:
                    seen_raj.add(key)
                    yogas.append(("Raj Yoga", sorted({klord, tlord})))

    lord_2 = house_lord(2, ascendant_sign_index)
    lord_11 = house_lord(11, ascendant_sign_index)
    if lord_2 != lord_11 and is_conjunct_or_exchanged(lord_2, lord_11):
        yogas.append(("Dhana Yoga", sorted({lord_2, lord_11})))
    elif lord_2 == lord_11:
        yogas.append(("Dhana Yoga", [lord_2]))

    return yogas


def detect_vedic_yogas(
    raw_planets: dict[str, tuple[float, bool]], ascendant_sign_index: int | None = None
) -> list[tuple[str, list[str]]]:
    """A first, deliberately small set of classical yogas (planetary
    combinations) -- chosen because each is well-documented and unambiguous
    to compute. Vedic yoga theory is vast; this is a starting set, not a
    claim of completeness.

    - Gaja Kesari Yoga: Jupiter in a kendra (0/3/6/9 signs, i.e. angularly
      1st/4th/7th/10th) from the Moon -- the Brihat Parashara Hora Shastra
      definition, relative to the Moon itself, not the ascendant.
    - Chandra-Mangal Yoga: Moon and Mars in the same sign.
    - Budhaditya Yoga: Sun and Mercury in the same sign.
    - Raj Yoga / Dhana Yoga: see detect_house_lordship_yogas -- only computed
      when ascendant_sign_index is known (birth time + location), same rule
      as houses generally throughout this backend.
    """
    sign_of = {name: int((lon % 360) // 30) for name, (lon, _retro) in raw_planets.items()}
    yogas: list[tuple[str, list[str]]] = []

    if "Jupiter" in sign_of and "Moon" in sign_of:
        diff = (sign_of["Jupiter"] - sign_of["Moon"]) % 12
        if diff in (0, 3, 6, 9):
            yogas.append(("Gaja Kesari Yoga", ["Moon", "Jupiter"]))

    if "Moon" in sign_of and "Mars" in sign_of and sign_of["Moon"] == sign_of["Mars"]:
        yogas.append(("Chandra-Mangal Yoga", ["Moon", "Mars"]))

    if "Sun" in sign_of and "Mercury" in sign_of and sign_of["Sun"] == sign_of["Mercury"]:
        yogas.append(("Budhaditya Yoga", ["Sun", "Mercury"]))

    if ascendant_sign_index is not None:
        yogas.extend(detect_house_lordship_yogas(sign_of, ascendant_sign_index))

    return yogas
