from app.calc import ephemeris
from app.calc.models import Aspect, BirthData, HouseCusp, NatalChart, PlanetPlacement

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
