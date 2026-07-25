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
    Ascendant, and the Midheaven can't be computed and come back null."""

    datetime: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    house_system: str = "P"  # Placidus


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


class NatalChart(BaseModel):
    planets: list[PlanetPlacement]
    houses: list[HouseCusp] | None
    ascendant: float | None
    midheaven: float | None
    aspects: list[Aspect]


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
