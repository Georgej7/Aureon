import math
from datetime import datetime, timedelta, timezone

from app.calc import ephemeris
from app.calc.models import (
    Aspect,
    BirthData,
    ChartPattern,
    HouseCusp,
    Mahadasha,
    MoonPhase,
    Nakshatra,
    NatalChart,
    NavamsaPlacement,
    CompositeChartRequest,
    DavisonChartRequest,
    PlanetPlacement,
    ProgressedChartRequest,
    SolarReturnRequest,
    SynastryAspect,
    SynastryResponse,
    TransitAspect,
    TransitPlanet,
    TransitsResponse,
    VedicChart,
    YogaPattern,
)
from app.calc.vedic import current_mahadasha, detect_vedic_yogas, nakshatra_for_longitude, navamsa_sign

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


def circular_midpoint_deg(a: float, b: float) -> float:
    """The angular midpoint of two degree values, taking the shorter arc
    between them -- e.g. the midpoint of 350 and 10 is 0, not 180. Naive
    arithmetic averaging ((a+b)/2) silently breaks near the 0/360 wrap
    boundary. Standard technique for averaging any circular quantity here:
    convert both to unit vectors, average those, convert back with atan2.
    Degenerate case: two values exactly 180 degrees apart have no single
    well-defined shorter-arc midpoint (both directions are equally short) --
    not specially handled, same as most astrology software, since it
    requires an exact 180.0000...-degree coincidence to occur."""
    rad_a, rad_b = math.radians(a), math.radians(b)
    x = (math.cos(rad_a) + math.cos(rad_b)) / 2
    y = (math.sin(rad_a) + math.sin(rad_b)) / 2
    # Two %360 passes, not one: float rounding right at the 0/360 boundary
    # can make the first pass land on exactly 360.0 instead of 0.0
    # (confirmed by reproducing it with circular_midpoint_deg(350, 10)) --
    # a second pass on a now-clean value always normalizes it correctly.
    return (math.degrees(math.atan2(y, x)) % 360) % 360


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


def detect_mystic_rectangles(aspects: list[Aspect]) -> list[ChartPattern]:
    """Two disjoint opposition pairs whose four cross-connections alternate
    between trine and sextile (not all-square, which would make this a Grand
    Cross instead) -- a closed, harmonious rectangle in the aspect chart."""
    oppositions = list(_aspect_pairs(aspects, "Opposition"))
    trines = _aspect_pairs(aspects, "Trine")
    sextiles = _aspect_pairs(aspects, "Sextile")
    patterns = []
    seen: set[frozenset[str]] = set()
    for i in range(len(oppositions)):
        for j in range(i + 1, len(oppositions)):
            a, b = tuple(oppositions[i])
            c, d = tuple(oppositions[j])
            if {a, b} & {c, d}:
                continue
            diag1a, diag1b = frozenset((a, c)), frozenset((b, d))
            diag2a, diag2b = frozenset((a, d)), frozenset((b, c))
            match = (diag1a in trines and diag1b in trines and diag2a in sextiles and diag2b in sextiles) or (
                diag1a in sextiles and diag1b in sextiles and diag2a in trines and diag2b in trines
            )
            if match:
                key = frozenset((a, b, c, d))
                if key not in seen:
                    seen.add(key)
                    patterns.append(ChartPattern(pattern_type="Mystic Rectangle", planets=sorted((a, b, c, d))))
    return patterns


def detect_kites(aspects: list[Aspect]) -> list[ChartPattern]:
    """A Grand Trine plus a 4th planet opposite one of the three and sextile
    to the other two -- the 'tail' that gives a self-contained Grand Trine an
    active outlet."""
    grand_trines = detect_grand_trines(aspects)
    oppositions = _aspect_pairs(aspects, "Opposition")
    sextiles = _aspect_pairs(aspects, "Sextile")
    all_planets = _all_planet_names(aspects)
    patterns = []
    seen: set[tuple[frozenset[str], str]] = set()
    for gt in grand_trines:
        a, b, c = gt.planets
        for d in all_planets:
            if d in (a, b, c):
                continue
            for apex, other1, other2 in ((a, b, c), (b, a, c), (c, a, b)):
                if (
                    frozenset((apex, d)) in oppositions
                    and frozenset((other1, d)) in sextiles
                    and frozenset((other2, d)) in sextiles
                ):
                    key = (frozenset((a, b, c)), d)
                    if key not in seen:
                        seen.add(key)
                        patterns.append(ChartPattern(pattern_type="Kite", planets=[a, b, c, d], apex=d))
    return patterns


def detect_chart_patterns(planets: list[PlanetPlacement], aspects: list[Aspect]) -> list[ChartPattern]:
    return (
        detect_stelliums(planets)
        + detect_grand_trines(aspects)
        + detect_t_squares(aspects)
        + detect_grand_crosses(aspects)
        + detect_yods(aspects)
        + detect_mystic_rectangles(aspects)
        + detect_kites(aspects)
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

    def minor_body_placement(name: str, longitude: float, retrograde: bool) -> PlanetPlacement:
        sign, sign_degree = longitude_to_sign(longitude)
        return PlanetPlacement(
            name=name,
            longitude=longitude,
            sign=sign,
            sign_degree=sign_degree,
            house=assign_house(longitude, cusps) if cusps is not None else None,
            retrograde=retrograde,
        )

    lilith = minor_body_placement("Lilith", *ephemeris.lilith_longitude(jd))
    chiron = minor_body_placement("Chiron", *ephemeris.chiron_longitude(jd))
    ceres = minor_body_placement("Ceres", *ephemeris.ceres_longitude(jd))
    pallas = minor_body_placement("Pallas", *ephemeris.pallas_longitude(jd))
    juno = minor_body_placement("Juno", *ephemeris.juno_longitude(jd))
    vesta = minor_body_placement("Vesta", *ephemeris.vesta_longitude(jd))

    return NatalChart(
        planets=planets,
        houses=houses,
        ascendant=ascendant,
        midheaven=midheaven,
        aspects=aspects,
        patterns=patterns,
        lilith=lilith,
        chiron=chiron,
        ceres=ceres,
        pallas=pallas,
        juno=juno,
        vesta=vesta,
    )


def build_solar_return_chart(request: SolarReturnRequest) -> tuple[str, NatalChart]:
    """A solar return chart: a full natal-style chart cast for the exact
    moment the transiting Sun returns to the person's natal Sun degree in a
    given year, read from wherever they are that year (defaults to their
    birth location -- a "relocated" solar return if latitude/longitude are
    given instead). Deliberately reuses build_natal_chart wholesale rather
    than duplicating the houses/aspects/patterns logic: a solar return chart
    is computed with exactly the same math as a birth chart, just for a
    different, later moment in time."""
    natal_jd = ephemeris.to_julian_day(request.birth.datetime)
    natal_sun_longitude, _retro = ephemeris.planet_longitudes(natal_jd)["Sun"]

    birth_dt = datetime.fromisoformat(request.birth.datetime)
    return_jd = ephemeris.find_solar_return_julian_day(
        natal_sun_longitude, request.target_year, birth_dt.month, birth_dt.day
    )
    return_datetime_iso = ephemeris.from_julian_day(return_jd)

    return_latitude = request.latitude if request.latitude is not None else request.birth.latitude
    return_longitude = request.longitude if request.longitude is not None else request.birth.longitude

    return_birth_data = BirthData(
        datetime=return_datetime_iso,
        latitude=return_latitude,
        longitude=return_longitude,
        house_system=request.house_system,
        time_known=True,
    )
    return return_datetime_iso, build_natal_chart(return_birth_data)


def build_progressed_chart(request: ProgressedChartRequest) -> tuple[str, NatalChart]:
    """Secondary progressions -- the "a day for a year" technique: planetary
    positions (and, by the same method, the angles/houses) as they stood N
    days after birth, where N is the number of years elapsed between birth
    and the target date. This is the standard, most widely used progression
    technique; other real techniques exist (solar arc directions, tertiary
    progressions) and aren't implemented here -- flagged the same way as
    every other documented convention choice in this codebase, not claimed
    as the only correct method. Reuses build_natal_chart wholesale, at the
    birth location (progressions read the birth place's houses evolving
    over time, not a relocated one -- distinct from solar returns, which are
    explicitly about "where you are this year")."""
    birth_dt = datetime.fromisoformat(request.birth.datetime)
    target_dt = datetime.fromisoformat(request.target_date)
    if target_dt.tzinfo is None:
        raise ValueError("target_date must include a UTC offset, e.g. '...T12:00:00+00:00'")

    age_years = (target_dt - birth_dt).total_seconds() / (365.25 * 86400)
    progressed_dt = birth_dt + timedelta(days=age_years)

    progressed_birth_data = BirthData(
        datetime=progressed_dt.isoformat(),
        latitude=request.birth.latitude,
        longitude=request.birth.longitude,
        house_system=request.house_system,
        time_known=request.birth.time_known,
    )
    return progressed_dt.isoformat(), build_natal_chart(progressed_birth_data)


def build_davison_chart(request: DavisonChartRequest) -> tuple[str, NatalChart]:
    """Davison chart -- Ronald Davison's technique: a genuine natal-style
    chart cast for the real midpoint MOMENT in time and midpoint LOCATION in
    space between two people's births, then computed exactly like any other
    chart. Distinct from a Composite chart (build_composite_chart), which
    instead midpoints each already-computed placement directly -- a Davison
    chart represents "the relationship as its own entity born at a real
    moment," a Composite represents "the mathematical blend of both
    people's charts." Both are real, established, different techniques, not
    two names for the same thing.

    Longitude uses circular_midpoint_deg (handles the antimeridian wrap
    correctly); latitude doesn't wrap the same way, so plain arithmetic mean
    is correct there."""
    jd_a = ephemeris.to_julian_day(request.person_a.datetime)
    jd_b = ephemeris.to_julian_day(request.person_b.datetime)
    midpoint_jd = (jd_a + jd_b) / 2
    midpoint_datetime = ephemeris.from_julian_day(midpoint_jd)

    midpoint_latitude = None
    midpoint_longitude = None
    if request.person_a.latitude is not None and request.person_b.latitude is not None:
        midpoint_latitude = (request.person_a.latitude + request.person_b.latitude) / 2
    if request.person_a.longitude is not None and request.person_b.longitude is not None:
        raw = circular_midpoint_deg(request.person_a.longitude, request.person_b.longitude)
        midpoint_longitude = raw - 360 if raw > 180 else raw  # BirthData.longitude expects -180..180

    davison_birth_data = BirthData(
        datetime=midpoint_datetime,
        latitude=midpoint_latitude,
        longitude=midpoint_longitude,
        house_system=request.house_system,
        time_known=request.person_a.time_known and request.person_b.time_known,
    )
    return midpoint_datetime, build_natal_chart(davison_birth_data)


def build_composite_chart(request: CompositeChartRequest) -> NatalChart:
    """Composite chart -- the midpoint-of-placements technique: composite
    Sun is the midpoint of the two natal Suns' longitudes, not the Sun's
    real position at some midpoint moment (that's what a Davison chart
    computes instead -- see build_davison_chart). Composite houses use the
    Equal system from the composite Ascendant, not whichever house_system a
    caller might otherwise request: a composite chart isn't cast for any
    real date/time, so Placidus-style time-based cusps (which depend on the
    diurnal arc at an actual moment) aren't meaningful here -- Equal-from-
    composite-Ascendant is the standard, documented convention specifically
    for this chart type. Composite planets never carry a real "retrograde"
    status -- that describes actual observed motion at a real moment, not a
    mathematical midpoint -- so it's always False here, not guessed from
    either natal chart."""
    chart_a = build_natal_chart(request.person_a)
    chart_b = build_natal_chart(request.person_b)

    def midpoint_placement(name: str, lon_a: float, lon_b: float) -> PlanetPlacement:
        mid_lon = circular_midpoint_deg(lon_a, lon_b)
        sign, sign_degree = longitude_to_sign(mid_lon)
        return PlanetPlacement(name=name, longitude=mid_lon, sign=sign, sign_degree=sign_degree, house=None, retrograde=False)

    planets_b_by_name = {p.name: p.longitude for p in chart_b.planets}
    composite_planets = [
        midpoint_placement(p.name, p.longitude, planets_b_by_name[p.name])
        for p in chart_a.planets
        if p.name in planets_b_by_name
    ]
    composite_lilith = midpoint_placement("Lilith", chart_a.lilith.longitude, chart_b.lilith.longitude)
    composite_chiron = midpoint_placement("Chiron", chart_a.chiron.longitude, chart_b.chiron.longitude)
    composite_ceres = midpoint_placement("Ceres", chart_a.ceres.longitude, chart_b.ceres.longitude)
    composite_pallas = midpoint_placement("Pallas", chart_a.pallas.longitude, chart_b.pallas.longitude)
    composite_juno = midpoint_placement("Juno", chart_a.juno.longitude, chart_b.juno.longitude)
    composite_vesta = midpoint_placement("Vesta", chart_a.vesta.longitude, chart_b.vesta.longitude)

    composite_ascendant = None
    composite_midheaven = None
    houses = None
    if chart_a.ascendant is not None and chart_b.ascendant is not None:
        composite_ascendant = circular_midpoint_deg(chart_a.ascendant, chart_b.ascendant)
    if chart_a.midheaven is not None and chart_b.midheaven is not None:
        composite_midheaven = circular_midpoint_deg(chart_a.midheaven, chart_b.midheaven)

    if composite_ascendant is not None:
        houses = []
        for house_num in range(1, 13):
            cusp_lon = (composite_ascendant + (house_num - 1) * 30) % 360
            sign, sign_degree = longitude_to_sign(cusp_lon)
            houses.append(HouseCusp(house=house_num, longitude=cusp_lon, sign=sign, sign_degree=sign_degree))
        cusp_longitudes = [h.longitude for h in houses]
        extra_points = [composite_lilith, composite_chiron, composite_ceres, composite_pallas, composite_juno, composite_vesta]
        for placement in [*composite_planets, *extra_points]:
            placement.house = assign_house(placement.longitude, cusp_longitudes)

    aspects = compute_aspects({p.name: p.longitude for p in composite_planets})
    patterns = detect_chart_patterns(composite_planets, aspects)

    return NatalChart(
        planets=composite_planets,
        houses=houses,
        ascendant=composite_ascendant,
        midheaven=composite_midheaven,
        aspects=aspects,
        patterns=patterns,
        lilith=composite_lilith,
        chiron=composite_chiron,
        ceres=composite_ceres,
        pallas=composite_pallas,
        juno=composite_juno,
        vesta=composite_vesta,
    )


def build_vedic_chart(birth: BirthData) -> VedicChart:
    jd = ephemeris.to_julian_day(birth.datetime)
    raw_planets = ephemeris.sidereal_longitudes(jd)
    rahu_longitude, rahu_retrograde = raw_planets["Rahu"]
    raw_planets["Ketu"] = ((rahu_longitude + 180) % 360, rahu_retrograde)

    has_location = birth.latitude is not None and birth.longitude is not None
    ascendant: float | None = None
    ascendant_sign_index: int | None = None
    if has_location and birth.time_known:
        ascendant = ephemeris.sidereal_ascendant(jd, birth.latitude, birth.longitude)
        ascendant_sign_index = int((ascendant % 360) // 30)

    planets = []
    for name, (longitude, retrograde) in raw_planets.items():
        sign, sign_degree = longitude_to_sign(longitude)
        house = None
        if ascendant_sign_index is not None:
            # Whole-sign houses: house = how many signs ahead of the
            # ascendant's sign this planet's sign is, wrapping at 12.
            planet_sign_index = int(longitude // 30) % 12
            house = ((planet_sign_index - ascendant_sign_index) % 12) + 1
        planets.append(
            PlanetPlacement(
                name=name, longitude=longitude, sign=sign, sign_degree=sign_degree,
                house=house, retrograde=retrograde,
            )
        )

    moon_longitude, _retro = raw_planets["Moon"]
    moon_nak_name, moon_nak_lord, moon_nak_fraction = nakshatra_for_longitude(moon_longitude)
    moon_nakshatra = Nakshatra(
        name=moon_nak_name, ruling_planet=moon_nak_lord, elapsed_fraction=moon_nak_fraction
    )

    ascendant_sign: str | None = None
    ascendant_nakshatra: Nakshatra | None = None
    if ascendant is not None:
        ascendant_sign, _degree = longitude_to_sign(ascendant)
        asc_nak_name, asc_nak_lord, asc_nak_fraction = nakshatra_for_longitude(ascendant)
        ascendant_nakshatra = Nakshatra(
            name=asc_nak_name, ruling_planet=asc_nak_lord, elapsed_fraction=asc_nak_fraction
        )

    birth_dt = datetime.fromisoformat(birth.datetime).astimezone(timezone.utc)
    now = datetime.now(timezone.utc)
    dasha = current_mahadasha(moon_longitude, birth_dt, now)

    navamsa = [
        NavamsaPlacement(name=name, sign=navamsa_sign(longitude))
        for name, (longitude, _retro) in raw_planets.items()
    ]
    yogas = [
        YogaPattern(yoga_type=yoga_type, planets=yoga_planets)
        for yoga_type, yoga_planets in detect_vedic_yogas(raw_planets, ascendant_sign_index)
    ]

    return VedicChart(
        planets=planets,
        ascendant=ascendant,
        ascendant_sign=ascendant_sign,
        ascendant_nakshatra=ascendant_nakshatra,
        moon_nakshatra=moon_nakshatra,
        current_mahadasha=Mahadasha(lord=dasha["lord"], start=dasha["start"], end=dasha["end"]),
        navamsa=navamsa,
        yogas=yogas,
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
