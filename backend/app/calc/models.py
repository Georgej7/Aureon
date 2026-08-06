from typing import Literal

from pydantic import BaseModel, Field

# The single-character codes swisseph's house() function expects. Limited to
# the systems professional astrologers actually ask for by name, not the
# full set swisseph supports -- each of these is well-documented and
# unambiguous; less common systems can be added the same way once there's
# real demand, rather than guessing at obscure codes now.
HouseSystem = Literal["P", "K", "E", "W", "C", "R", "O"]

HOUSE_SYSTEM_NAMES: dict[str, str] = {
    "P": "Placidus",
    "K": "Koch",
    "E": "Equal",
    "W": "Whole Sign",
    "C": "Campanus",
    "R": "Regiomontanus",
    "O": "Porphyry",
}


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
    house_system: HouseSystem = "P"
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
    lilith: PlanetPlacement
    chiron: PlanetPlacement
    ceres: PlanetPlacement
    pallas: PlanetPlacement
    juno: PlanetPlacement
    vesta: PlanetPlacement


class Nakshatra(BaseModel):
    name: str
    ruling_planet: str
    elapsed_fraction: float  # 0-1, how far through this nakshatra


class Mahadasha(BaseModel):
    """The current major planetary period (Vimshottari dasha) — not a
    prediction, a deterministic timeline position computed from the Moon's
    birth nakshatra. start/end are ISO 8601 UTC datetimes."""

    lord: str
    start: str
    end: str


class KuaRequest(BaseModel):
    birth_year: int = Field(ge=1900, le=2100)
    gender: Literal["male", "female"]  # the two categories the Kua formula itself distinguishes


class KuaProfile(BaseModel):
    kua_number: int
    group: str  # "East" | "West"
    element: str
    sheng_chi: str  # success/prosperity direction
    tien_yi: str  # health direction
    nien_yen: str  # relationships/harmony direction
    fu_wei: str  # personal growth/stability direction


Compass = Literal["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


class BaguaRequest(BaseModel):
    facing_direction: Compass  # direction faced when walking in through the entrance


class BaguaZone(BaseModel):
    position: str  # e.g. "top_left", "center"
    zone: str  # e.g. "Wealth & Fortune"
    element: str
    direction: Compass | None  # null for center — no wall to be oriented toward


class BaguaResponse(BaseModel):
    zones: list[BaguaZone]


class NavamsaPlacement(BaseModel):
    name: str
    sign: str  # D9 sign -- a different, finer-grained placement than the D1 (rashi) sign


class YogaPattern(BaseModel):
    """A classical planetary combination (see app/calc/vedic.py's
    detect_vedic_yogas for which ones are currently detected and why)."""

    yoga_type: str
    planets: list[str]


class VedicChart(BaseModel):
    """Sidereal (Lahiri ayanamsa) chart — a genuinely different reference
    frame from NatalChart's tropical zodiac, not a re-labeling of the same
    numbers. planets includes Rahu and Ketu (the lunar nodes), central to
    Vedic astrology but absent from Western charts. ascendant/ascendant_sign/
    ascendant_nakshatra are null without a known birth location and time,
    same rule as NatalChart's houses — moon_nakshatra and current_mahadasha
    need only the Moon's position, so they're always present. navamsa (D9)
    and yogas are sign-based, so they're always present too, independent of
    a known birth time/location, same reasoning as planets/nakshatra."""

    planets: list[PlanetPlacement]
    ascendant: float | None
    ascendant_sign: str | None
    ascendant_nakshatra: Nakshatra | None
    moon_nakshatra: Nakshatra
    current_mahadasha: Mahadasha
    navamsa: list[NavamsaPlacement]
    yogas: list[YogaPattern]


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


class SolarReturnRequest(BaseModel):
    birth: BirthData
    target_year: int = Field(ge=1900, le=2100)
    # Defaults to the birth location if omitted -- set these for a
    # "relocated" solar return (the real technique of reading the return
    # chart from wherever the person will actually be that year).
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    house_system: HouseSystem = "P"


class SolarReturnResponse(BaseModel):
    exact_datetime: str  # ISO 8601 UTC -- the precise moment of the return
    chart: NatalChart


class ProgressedChartRequest(BaseModel):
    birth: BirthData
    target_date: str  # ISO 8601 with UTC offset -- "as of" date for the progression
    house_system: HouseSystem = "P"


class ProgressedChartResponse(BaseModel):
    progressed_datetime: str  # ISO 8601 -- the actual "day for a year" moment used
    chart: NatalChart


class DavisonChartRequest(BaseModel):
    person_a: BirthData
    person_b: BirthData
    house_system: HouseSystem = "P"


class DavisonChartResponse(BaseModel):
    midpoint_datetime: str  # ISO 8601 UTC -- the real midpoint moment this chart is cast for
    chart: NatalChart


class CompositeChartRequest(BaseModel):
    person_a: BirthData
    person_b: BirthData


class NumerologyRequest(BaseModel):
    full_name: str
    date: str  # "YYYY-MM-DD"
    target_year: int | None = None  # defaults to current year for personal_year


class ChineseZodiacRequest(BaseModel):
    birth_year: int = Field(ge=1900, le=2100)


class ChineseZodiacProfile(BaseModel):
    animal: str
    element: str
    yin_yang: str


class ElectionalScanRequest(BaseModel):
    birth_date: str  # "YYYY-MM-DD"
    start_date: str  # "YYYY-MM-DD"
    days: int = Field(default=30, ge=1, le=90)


class ElectionalDay(BaseModel):
    date: str
    personal_day_number: int
    favorable_numerology: bool
    mercury_retrograde: bool
    moon_phase: str


class ElectionalScanResponse(BaseModel):
    days: list[ElectionalDay]


class HumanDesignRequest(BaseModel):
    datetime: str  # ISO 8601 with UTC offset, same rule as BirthData


class HumanDesignChannel(BaseModel):
    gates: list[int]  # always length 2
    name: str


class HumanDesignChart(BaseModel):
    type: str
    strategy: str
    authority: str
    profile: str
    definition: str
    defined_centers: list[str]
    undefined_centers: list[str]
    active_gates: list[int]
    active_channels: list[HumanDesignChannel]


class TarotDrawRequest(BaseModel):
    seed: str  # e.g. f"{user_id}:{date}" -- same seed always returns the same card


class TarotCard(BaseModel):
    name: str
    upright: bool


class EphemerisDayRequest(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")  # "YYYY-MM-DD"


class EphemerisDayResponse(BaseModel):
    date: str
    planets: list[PlanetPlacement]  # house is always null -- a plain ephemeris has no location/houses


class AspectSearchRequest(BaseModel):
    planet_a: str
    planet_b: str
    aspect_type: str
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    days: int = Field(default=365, ge=1, le=3650)  # up to 10 years -- outer-planet aspects can be rare


class AspectSearchHit(BaseModel):
    date: str
    orb: float
    exact: bool  # within 0.1 degree -- close enough to call it "exact" for that day


class AspectSearchResponse(BaseModel):
    hits: list[AspectSearchHit]
    searched_days: int


class AstrocartographyRequest(BaseModel):
    birth: BirthData


class AstrocartographyLatLon(BaseModel):
    latitude: float
    longitude: float


class PlanetLines(BaseModel):
    planet: str
    mc_longitude: float  # a single meridian -- MC/IC are straight vertical lines
    ic_longitude: float
    asc_curve: list[AstrocartographyLatLon]  # ASC/DSC are curved -- one point per sampled latitude
    desc_curve: list[AstrocartographyLatLon]


class AstrocartographyResponse(BaseModel):
    lines: list[PlanetLines]


class VoidOfCourseRequest(BaseModel):
    start_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    days: int = Field(default=30, ge=1, le=90)


class VoidOfCoursePeriod(BaseModel):
    start: str  # ISO 8601 UTC -- the Moon's last major aspect before leaving its sign
    end: str  # ISO 8601 UTC -- the exact sign-ingress moment
    leaving_sign: str
    entering_sign: str | None  # null if the ingress falls after the requested scan window


class VoidOfCourseResponse(BaseModel):
    periods: list[VoidOfCoursePeriod]


class NumerologyProfile(BaseModel):
    life_path: int
    expression: int
    soul_urge: int
    personality: int
    personal_year: int
    pinnacles: list[int]
    challenges: list[int]
    karmic_debts: list[int]
