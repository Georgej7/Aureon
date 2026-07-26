from datetime import datetime, timezone

from app.calc import ephemeris
from app.calc.models import (
    Aspect,
    BirthData,
    ChartPattern,
    HouseCusp,
    MoonPhase,
    NatalChart,
    PlanetPlacement,
    SynastryAspect,
    SynastryResponse,
    TransitAspect,
    TransitPlanet,
    TransitsResponse,
)

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

# (name, exact angle, orb) — 5 major aspects (wider orbs, considered stronger)
# plus 4 minor aspects (tighter orbs, considered subtler/weaker). Angles are
# spaced far enough apart relative to their orbs that no two definitions can
# ever both match the same angular difference — order doesn't affect results.
ASPECT_DEFINITIONS = [
    ("Conjunction", 0, 8),
    ("Semisextile", 30, 2),
    ("Semisquare", 45, 2),
    ("Sextile", 60, 6),
    ("Square", 90, 8),
    ("Trine", 120, 8),
    ("Sesquiquadrate", 135, 2),
    ("Quincunx", 150, 3),
    ("Opposition", 180, 8),
]

# Sun-Moon angle divided into 8 equal 45-degree slices, starting at New Moon (0 deg).
MOON_PHASE_NAMES = [
    "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
    "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
]


def longitude_to_sign(longitude: float) -> tuple[str, float]:
    longitude = longitude % 360
    index = int(longitude // 30) % 12
    return SIGNS[index], longitude % 30


def assign_house(longitude: float, cusps: list[float]) -> int:
    longitude = longitude % 360
    for i in range(12):
        start = cusps[i]
        end = cusps[(i + 1) % 12]
        if start <= end:
            if start <= longitude < end:
                return i + 1
        else:  # house wraps across the 360/0 boundary
            if longitude >= start or longitude < end:
                return i + 1
    return 12  # unreachable in practice, but keeps the function total


def compute_aspects(planet_longitudes: dict[str, float]) -> list[Aspect]:
    names = list(planet_longitudes.keys())
    aspects: list[Aspect] = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            diff = abs(planet_longitudes[a] - planet_longitudes[b]) % 360
            diff = min(diff, 360 - diff)
            for aspect_type, angle, orb in ASPECT_DEFINITIONS:
                delta = abs(diff - angle)
                if delta <= orb:
                    aspects.append(
                        Aspect(planet_a=a, planet_b=b, aspect_type=aspect_type, angle=diff, orb=delta)
                    )
                    break
    return aspects


def _aspect_pairs(aspects: list[Aspect], aspect_type: str) -> set[frozenset[str]]:
    return {frozenset((a.planet_a, a.planet_b)) for a in aspects if a.aspect_type == aspect_type}


def _all_planet_names(aspects: list[Aspect]) -> list[str]:
    return sorted({name for a in aspects for name in (a.planet_a, a.planet_b)})


def detect_stelliums(planets: list[PlanetPlacement]) -> list[ChartPattern]:
    """3+ planets sharing a sign — sign-based (not house-based) so this works
    even without a known birth time/location, same reasoning as planet signs
    generally not depending on houses elsewhere in this module."""
    by_sign: dict[str, list[str]] = {}
    for p in planets:
        by_sign.setdefault(p.sign, []).append(p.name)
    return [
        ChartPattern(pattern_type="Stellium", planets=names)
        for names in by_sign.values()
        if len(names) >= 3
    ]


def detect_grand_trines(aspects: list[Aspect]) -> list[ChartPattern]:
    """3 planets mutually trine — a closed triangle in the trine graph."""
    trines = _aspect_pairs(aspects, "Trine")
    planets = sorted({p for pair in trines for p in pair})
    patterns = []
    for i in range(len(planets)):
        for j in range(i + 1, len(planets)):
            for k in range(j + 1, len(planets)):
                a, b, c = planets[i], planets[j], planets[k]
                if {frozenset((a, b)), frozenset((b, c)), frozenset((a, c))} <= trines:
                    patterns.append(ChartPattern(pattern_type="Grand Trine", planets=[a, b, c]))
    return patterns


def detect_t_squares(aspects: list[Aspect]) -> list[ChartPattern]:
    """An opposition pair both square to a third planet (the apex)."""
    oppositions = _aspect_pairs(aspects, "Opposition")
    squares = _aspect_pairs(aspects, "Square")
    all_planets = _all_planet_names(aspects)
    patterns = []
    for opp in oppositions:
        a, b = tuple(opp)
        for c in all_planets:
            if c in (a, b):
                continue
            if frozenset((a, c)) in squares and frozenset((b, c)) in squares:
                patterns.append(ChartPattern(pattern_type="T-Square", planets=[a, b, c], apex=c))
    return patterns


def detect_grand_crosses(aspects: list[Aspect]) -> list[ChartPattern]:
    """Two opposition pairs (4 distinct planets) that are also all mutually square."""
    oppositions = list(_aspect_pairs(aspects, "Opposition"))
    squares = _aspect_pairs(aspects, "Square")
    patterns = []
    for i in range(len(oppositions)):
        for j in range(i + 1, len(oppositions)):
            a, b = tuple(oppositions[i])
            c, d = tuple(oppositions[j])
            if {a, b} & {c, d}:
                continue  # must be 4 distinct planets
            if (
                frozenset((a, c)) in squares
                and frozenset((a, d)) in squares
                and frozenset((b, c)) in squares
                and frozenset((b, d)) in squares
            ):
                patterns.append(ChartPattern(pattern_type="Grand Cross", planets=[a, b, c, d]))
    return patterns


def detect_yods(aspects: list[Aspect]) -> list[ChartPattern]:
    """Two planets in sextile, both quincunx to a third planet (the apex)."""
    sextiles = _aspect_pairs(aspects, "Sextile")
    quincunxes = _aspect_pairs(aspects, "Quincunx")
    all_planets = _all_planet_names(aspects)
    patterns = []
    for sext in sextiles:
        a, b = tuple(sext)
        for c in all_planets:
            if c in (a, b):
                continue
            if frozenset((a, c)) in quincunxes and frozenset((b, c)) in quincunxes:
                patterns.append(ChartPattern(pattern_type="Yod", planets=[a, b, c], apex=c))
    return patterns


def detect_chart_patterns(planets: list[PlanetPlacement], aspects: list[Aspect]) -> list[ChartPattern]:
    return (
        detect_stelliums(planets)
        + detect_grand_trines(aspects)
        + detect_t_squares(aspects)
        + detect_grand_crosses(aspects)
        + detect_yods(aspects)
    )


def build_natal_chart(birth: BirthData) -> NatalChart:
    jd = ephemeris.to_julian_day(birth.datetime)
    raw_planets = ephemeris.planet_longitudes(jd)

    # Houses/Ascendant/Midheaven need a birth location AND a real birth time —
    # planet sign/degree don't. Without lat/lon, or with a guessed birth time,
    # skip house computation entirely rather than returning numbers that look
    # precise but aren't.
    has_location = birth.latitude is not None and birth.longitude is not None
    cusps: list[float] | None = None
    ascendant: float | None = None
    midheaven: float | None = None
    if has_location and birth.time_known:
        cusps, ascendant, midheaven = ephemeris.house_cusps(
            jd, birth.latitude, birth.longitude, birth.house_system
        )

    planets = []
    for name, (longitude, retrograde) in raw_planets.items():
        sign, sign_degree = longitude_to_sign(longitude)
        planets.append(
            PlanetPlacement(
                name=name,
                longitude=longitude,
                sign=sign,
                sign_degree=sign_degree,
                house=assign_house(longitude, cusps) if cusps is not None else None,
                retrograde=retrograde,
            )
        )

    houses = None
    if cusps is not None:
        houses = []
        for i, cusp_longitude in enumerate(cusps):
            sign, sign_degree = longitude_to_sign(cusp_longitude)
            houses.append(
                HouseCusp(house=i + 1, longitude=cusp_longitude, sign=sign, sign_degree=sign_degree)
            )

    aspects = compute_aspects({name: lon for name, (lon, _retro) in raw_planets.items()})
    patterns = detect_chart_patterns(planets, aspects)

    return NatalChart(
        planets=planets,
        houses=houses,
        ascendant=ascendant,
        midheaven=midheaven,
        aspects=aspects,
        patterns=patterns,
    )


def _cross_aspects(
    set_a: dict[str, float], set_b: dict[str, float]
) -> list[tuple[str, str, str, float, float]]:
    """Aspects between two independent sets of planet longitudes, checking
    every (a, b) pair independently — unlike compute_aspects() (which compares
    planets within a single chart and only checks each pair once), planet X
    from set_a to planet Y from set_b is a different result from Y to X, and
    both are checked. Shared by transits (today's sky vs. a natal chart) and
    synastry (one person's chart vs. another's) — the aspect math is
    identical, only what the two sets represent differs.
    Returns (name_a, name_b, aspect_type, angle, orb) tuples."""
    results: list[tuple[str, str, str, float, float]] = []
    for name_a, lon_a in set_a.items():
        for name_b, lon_b in set_b.items():
            diff = abs(lon_a - lon_b) % 360
            diff = min(diff, 360 - diff)
            for aspect_type, angle, orb in ASPECT_DEFINITIONS:
                delta = abs(diff - angle)
                if delta <= orb:
                    results.append((name_a, name_b, aspect_type, diff, delta))
                    break
    return results


def compute_transit_aspects(
    transiting_longitudes: dict[str, float], natal_longitudes: dict[str, float]
) -> list[TransitAspect]:
    """Aspects between today's planet positions and a natal chart's."""
    return [
        TransitAspect(transiting_planet=a, natal_planet=b, aspect_type=t, angle=angle, orb=orb)
        for a, b, t, angle, orb in _cross_aspects(transiting_longitudes, natal_longitudes)
    ]


def compute_synastry_aspects(
    person_a_longitudes: dict[str, float], person_b_longitudes: dict[str, float]
) -> list[SynastryAspect]:
    """Aspects between two different people's natal charts."""
    return [
        SynastryAspect(person_a_planet=a, person_b_planet=b, aspect_type=t, angle=angle, orb=orb)
        for a, b, t, angle, orb in _cross_aspects(person_a_longitudes, person_b_longitudes)
    ]


def compute_synastry(birth_a: BirthData, birth_b: BirthData) -> SynastryResponse:
    """Two independent natal charts plus the inter-aspects between them —
    no fabricated 'compatibility score': astrology has no single agreed
    formula for reducing a chart comparison to one number, so this surfaces
    the real computed aspects and leaves interpretation to the knowledge
    base / AI chat, same principle as the rest of the calc engine."""
    chart_a = build_natal_chart(birth_a)
    chart_b = build_natal_chart(birth_b)
    aspects = compute_synastry_aspects(
        {p.name: p.longitude for p in chart_a.planets},
        {p.name: p.longitude for p in chart_b.planets},
    )
    return SynastryResponse(person_a=chart_a, person_b=chart_b, aspects=aspects)


def moon_phase(sun_longitude: float, moon_longitude: float) -> tuple[str, float]:
    angle = (moon_longitude - sun_longitude) % 360
    index = int(angle // 45) % 8
    return MOON_PHASE_NAMES[index], angle


def compute_transits(natal_longitudes: dict[str, float]) -> TransitsResponse:
    """Today's planet positions compared against an already-known natal
    chart. Always uses the current moment — transits are inherently a 'right
    now' reading, not something tied to a specific requested instant."""
    now_iso = datetime.now(timezone.utc).isoformat()
    jd = ephemeris.to_julian_day(now_iso)
    raw_planets = ephemeris.planet_longitudes(jd)

    transiting_planets = []
    for name, (longitude, retrograde) in raw_planets.items():
        sign, sign_degree = longitude_to_sign(longitude)
        transiting_planets.append(
            TransitPlanet(
                name=name, longitude=longitude, sign=sign, sign_degree=sign_degree, retrograde=retrograde
            )
        )

    aspects = compute_transit_aspects(
        {name: lon for name, (lon, _retro) in raw_planets.items()}, natal_longitudes
    )

    phase_name, phase_angle = moon_phase(raw_planets["Sun"][0], raw_planets["Moon"][0])

    return TransitsResponse(
        transiting_planets=transiting_planets,
        aspects=aspects,
        moon_phase=MoonPhase(name=phase_name, angle=phase_angle),
    )
