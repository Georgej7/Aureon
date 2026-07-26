from pydantic import BaseModel, Field


class BirthData(BaseModel):
    """Birth moment and place. `datetime` must be an ISO 8601 string with a UTC
    offset (e.g. "1993-03-14T04:12:00-05:00") since natal charts need an exact
    instant, not a local wall-clock time alone. No geocoding here — latitude/
    longitude, if provided, are required directly; place-name lookup is an
    onboarding-UX concern for later.

    latitude/longitude are optional: plenty of people don't know their exact
    birth coordinates. Without them, planet positions (sign/degree) are still
    fully accurate — they don't depend on location — but houses, the
    Ascendant, and the Midheaven can't be computed and come back null.

    time_known follows the same idea for birth time: plenty of people don't
    know their exact birth time either. When False, the caller should still
    send a placeholder time in `datetime` (the frontend defaults to noon) so
    the timestamp parses, but houses/Ascendant/Midheaven come back null
    regardless of whether latitude/longitude are present — a guessed time
    makes those numbers meaningless, not just imprecise, since the Ascendant
    moves roughly a full sign every two hours."""

    datetime: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    house_system: str = "P"  # Placidus
    time_known: bool = True


class PlanetPlacement(BaseModel):
    name: str
    longitude: float
    sign: str
    sign_degree: float
    house: int | None
    retrograde: bool


class HouseCusp(BaseModel):
    house: int
    longitude: float
    sign: str
    sign_degree: float


class Aspect(BaseModel):
    planet_a: str
    planet_b: str
    aspect_type: str
    angle: float
    orb: float


class ChartPattern(BaseModel):
    """A configuration formed by multiple aspects across 3+ planets (a
    stellium, grand trine, T-square, grand cross, or yod). `apex` is set
    only for patterns with a single focal planet (T-square, yod)."""

    pattern_type: str
    planets: list[str]
    apex: str | None = None


class NatalChart(BaseModel):
    planets: list[PlanetPlacement]
    houses: list[HouseCusp] | None
    ascendant: float | None
    midheaven: float | None
    aspects: list[Aspect]
    patterns: list[ChartPattern]


class NatalPlanetLongitude(BaseModel):
    """Minimal planet identity needed to compute transits against a chart
    the caller already has — just name + longitude, not the full
    PlanetPlacement (sign/house/retrograde aren't needed for aspect math)."""

    name: str
    longitude: float


class TransitsRequest(BaseModel):
    natal_planets: list[NatalPlanetLongitude]


class TransitPlanet(BaseModel):
    name: str
    longitude: float
    sign: str
    sign_degree: float
    retrograde: bool


class TransitAspect(BaseModel):
    transiting_planet: str
    natal_planet: str
    aspect_type: str
    angle: float
    orb: float


class MoonPhase(BaseModel):
    name: str
    angle: float  # Sun-Moon angle in degrees, 0-360


class TransitsResponse(BaseModel):
    transiting_planets: list[TransitPlanet]
    aspects: list[TransitAspect]
    moon_phase: MoonPhase


class SynastryRequest(BaseModel):
    person_a: BirthData
    person_b: BirthData


class SynastryAspect(BaseModel):
    person_a_planet: str
    person_b_planet: str
    aspect_type: str
    angle: float
    orb: float


class SynastryResponse(BaseModel):
    person_a: NatalChart
    person_b: NatalChart
    aspects: list[SynastryAspect]


class NumerologyRequest(BaseModel):
    full_name: str
    date: str  # "YYYY-MM-DD"
    target_year: int | None = None  # defaults to current year for personal_year


class NumerologyProfile(BaseModel):
    life_path: int
    expression: int
    soul_urge: int
    personality: int
    personal_year: int
