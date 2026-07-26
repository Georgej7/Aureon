from datetime import datetime, timezone

from app.calc import ephemeris
from app.calc.models import (
    Aspect,
    BirthData,
    HouseCusp,
    MoonPhase,
    NatalChart,
    PlanetPlacement,
    TransitAspect,
    TransitPlanet,
    TransitsResponse,
)

SIGNS = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]

# (name, exact angle, orb) — standard major aspects
ASPECT_DEFINITIONS = [
    ("Conjunction", 0, 8),
    ("Sextile", 60, 6),
    ("Square", 90, 8),
    ("Trine", 120, 8),
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

    return NatalChart(
        planets=planets,
        houses=houses,
        ascendant=ascendant,
        midheaven=midheaven,
        aspects=aspects,
    )


def compute_transit_aspects(
    transiting_longitudes: dict[str, float], natal_longitudes: dict[str, float]
) -> list[TransitAspect]:
    """Aspects between today's planet positions and a natal chart's. Unlike
    compute_aspects() (which compares planets within one chart and only checks
    each pair once), this checks every transiting/natal pair independently —
    transiting Mars to natal Sun is a different aspect from transiting Sun to
    natal Mars, and both are checked."""
    aspects: list[TransitAspect] = []
    for t_name, t_lon in transiting_longitudes.items():
        for n_name, n_lon in natal_longitudes.items():
            diff = abs(t_lon - n_lon) % 360
            diff = min(diff, 360 - diff)
            for aspect_type, angle, orb in ASPECT_DEFINITIONS:
                delta = abs(diff - angle)
                if delta <= orb:
                    aspects.append(
                        TransitAspect(
                            transiting_planet=t_name,
                            natal_planet=n_name,
                            aspect_type=aspect_type,
                            angle=diff,
                            orb=delta,
                        )
                    )
                    break
    return aspects


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
