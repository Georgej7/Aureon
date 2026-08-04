const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PlanetPlacement = {
  name: string;
  longitude: number;
  sign: string;
  sign_degree: number;
  house: number | null;
  retrograde: boolean;
};

export type HouseCusp = {
  house: number;
  longitude: number;
  sign: string;
  sign_degree: number;
};

export type Aspect = {
  planet_a: string;
  planet_b: string;
  aspect_type: string;
  angle: number;
  orb: number;
};

export type ChartPattern = {
  pattern_type: string;
  planets: string[];
  apex: string | null;
};

export type NatalChart = {
  planets: PlanetPlacement[];
  houses: HouseCusp[] | null;
  ascendant: number | null;
  midheaven: number | null;
  aspects: Aspect[];
  patterns: ChartPattern[];
  lilith: PlanetPlacement;
  chiron: PlanetPlacement;
  ceres: PlanetPlacement;
  pallas: PlanetPlacement;
  juno: PlanetPlacement;
  vesta: PlanetPlacement;
};

export type NumerologyProfile = {
  life_path: number;
  expression: number;
  soul_urge: number;
  personality: number;
  personal_year: number;
  pinnacles: number[];
  challenges: number[];
  karmic_debts: number[];
};

// The house systems the backend accepts -- see backend/app/calc/models.py's
// HOUSE_SYSTEM_NAMES for the full display-name mapping.
export type HouseSystem = "P" | "K" | "E" | "W" | "C" | "R" | "O";

export const HOUSE_SYSTEM_NAMES: Record<HouseSystem, string> = {
  P: "Placidus",
  K: "Koch",
  E: "Equal",
  W: "Whole Sign",
  C: "Campanus",
  R: "Regiomontanus",
  O: "Porphyry",
};

// The four subscription tiers -- kept as one shared type so adding a tier
// (like Practitioner) is a single change, not eight separate inline unions
// scattered across every page that gates a feature by tier.
export type SubscriptionTier = "free" | "premium" | "vip" | "practitioner";

export type NatalChartRequest = {
  datetime: string;
  latitude?: number;
  longitude?: number;
  time_known?: boolean;
  house_system?: HouseSystem;
};

export type NumerologyRequest = {
  full_name: string;
  date: string;
  target_year?: number;
};

export type TransitsRequest = {
  natal_planets: { name: string; longitude: number }[];
};

export type SynastryRequest = {
  person_a: NatalChartRequest;
  person_b: NatalChartRequest;
};

export type SynastryAspect = {
  person_a_planet: string;
  person_b_planet: string;
  aspect_type: string;
  angle: number;
  orb: number;
};

export type Synastry = {
  person_a: NatalChart;
  person_b: NatalChart;
  aspects: SynastryAspect[];
};

export type TransitPlanet = {
  name: string;
  longitude: number;
  sign: string;
  sign_degree: number;
  retrograde: boolean;
};

export type TransitAspect = {
  transiting_planet: string;
  natal_planet: string;
  aspect_type: string;
  angle: number;
  orb: number;
};

export type MoonPhase = {
  name: string;
  angle: number;
};

export type Transits = {
  transiting_planets: TransitPlanet[];
  aspects: TransitAspect[];
  moon_phase: MoonPhase;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function postJson<TResponse>(path: string, body: unknown, token?: string): Promise<TResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      // response wasn't JSON — fall back to the generic message below
    }
    throw new ApiError(res.status, detail || `${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<TResponse>;
}

export function postNatalChart(payload: NatalChartRequest, token: string): Promise<NatalChart> {
  return postJson<NatalChart>("/api/chart/natal", payload, token);
}

export type SolarReturnRequest = {
  birth: NatalChartRequest;
  target_year: number;
  latitude?: number;
  longitude?: number;
  house_system?: HouseSystem;
};

export type SolarReturnResponse = {
  exact_datetime: string;
  chart: NatalChart;
};

export function postSolarReturn(payload: SolarReturnRequest, token: string): Promise<SolarReturnResponse> {
  return postJson<SolarReturnResponse>("/api/chart/solar-return", payload, token);
}

export type ProgressedChartRequest = {
  birth: NatalChartRequest;
  target_date: string;
  house_system?: HouseSystem;
};

export type ProgressedChartResponse = {
  progressed_datetime: string;
  chart: NatalChart;
};

export function postProgressedChart(
  payload: ProgressedChartRequest,
  token: string
): Promise<ProgressedChartResponse> {
  return postJson<ProgressedChartResponse>("/api/chart/progressed", payload, token);
}

export type DavisonChartRequest = {
  person_a: NatalChartRequest;
  person_b: NatalChartRequest;
  house_system?: HouseSystem;
};

export type DavisonChartResponse = {
  midpoint_datetime: string;
  chart: NatalChart;
};

export function postDavisonChart(payload: DavisonChartRequest, token: string): Promise<DavisonChartResponse> {
  return postJson<DavisonChartResponse>("/api/chart/davison", payload, token);
}

export type CompositeChartRequest = {
  person_a: NatalChartRequest;
  person_b: NatalChartRequest;
};

export function postCompositeChart(payload: CompositeChartRequest, token: string): Promise<NatalChart> {
  return postJson<NatalChart>("/api/chart/composite", payload, token);
}

export function postNumerology(payload: NumerologyRequest, token: string): Promise<NumerologyProfile> {
  return postJson<NumerologyProfile>("/api/numerology", payload, token);
}

export function postTransits(payload: TransitsRequest, token: string): Promise<Transits> {
  return postJson<Transits>("/api/chart/transits", payload, token);
}

export function postSynastry(payload: SynastryRequest, token: string): Promise<Synastry> {
  return postJson<Synastry>("/api/chart/synastry", payload, token);
}

export type Nakshatra = {
  name: string;
  ruling_planet: string;
  elapsed_fraction: number;
};

export type Mahadasha = {
  lord: string;
  start: string;
  end: string;
};

export type NavamsaPlacement = {
  name: string;
  sign: string;
};

export type YogaPattern = {
  yoga_type: string;
  planets: string[];
};

export type VedicChart = {
  planets: PlanetPlacement[];
  ascendant: number | null;
  ascendant_sign: string | null;
  ascendant_nakshatra: Nakshatra | null;
  moon_nakshatra: Nakshatra;
  current_mahadasha: Mahadasha;
  navamsa: NavamsaPlacement[];
  yogas: YogaPattern[];
};

export function postVedicChart(payload: NatalChartRequest, token: string): Promise<VedicChart> {
  return postJson<VedicChart>("/api/chart/vedic", payload, token);
}

export type TarotCard = {
  name: string;
  upright: boolean;
};

// seed should be deterministic per draw you want to be stable -- e.g.
// `${userId}:${todayIsoDate}` for a once-a-day card, or `${userId}:${Date.now()}`
// for a fresh pull every time.
export function postTarotDraw(seed: string, token: string): Promise<TarotCard> {
  return postJson<TarotCard>("/api/tarot/draw", { seed }, token);
}

export type ChineseZodiacProfile = {
  animal: string;
  element: string;
  yin_yang: string;
};

export function postChineseZodiac(birthYear: number, token: string): Promise<ChineseZodiacProfile> {
  return postJson<ChineseZodiacProfile>("/api/chinese-astrology/zodiac", { birth_year: birthYear }, token);
}

export type HumanDesignChart = {
  type: string;
  strategy: string;
  authority: string;
  profile: string;
  defined_centers: string[];
  undefined_centers: string[];
  active_gates: number[];
};

export function postHumanDesignChart(datetime: string, token: string): Promise<HumanDesignChart> {
  return postJson<HumanDesignChart>("/api/human-design/chart", { datetime }, token);
}

export type ElectionalDay = {
  date: string;
  personal_day_number: number;
  favorable_numerology: boolean;
  mercury_retrograde: boolean;
  moon_phase: string;
};

export type ElectionalScanRequest = {
  birth_date: string;
  start_date: string;
  days?: number;
};

export function postFinancialTiming(
  payload: ElectionalScanRequest,
  token: string
): Promise<{ days: ElectionalDay[] }> {
  return postJson<{ days: ElectionalDay[] }>("/api/electional/financial-timing", payload, token);
}

export type EphemerisDayResponse = {
  date: string;
  planets: PlanetPlacement[];
};

export function postEphemerisDay(date: string, token: string): Promise<EphemerisDayResponse> {
  return postJson<EphemerisDayResponse>("/api/ephemeris/day", { date }, token);
}

export type AspectSearchRequest = {
  planet_a: string;
  planet_b: string;
  aspect_type: string;
  start_date: string;
  days?: number;
};

export type AspectSearchHit = {
  date: string;
  orb: number;
  exact: boolean;
};

export type AspectSearchResponse = {
  hits: AspectSearchHit[];
  searched_days: number;
};

export function postAspectSearch(
  payload: AspectSearchRequest,
  token: string
): Promise<AspectSearchResponse> {
  return postJson<AspectSearchResponse>("/api/ephemeris/aspect-search", payload, token);
}

export type KuaRequest = {
  birth_year: number;
  gender: "male" | "female";
};

export type KuaProfile = {
  kua_number: number;
  group: string;
  element: string;
  sheng_chi: string;
  tien_yi: string;
  nien_yen: string;
  fu_wei: string;
};

export function postKua(payload: KuaRequest, token: string): Promise<KuaProfile> {
  return postJson<KuaProfile>("/api/feng-shui/kua", payload, token);
}

export type Compass = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type BaguaRequest = {
  facing_direction: Compass;
};

export type BaguaZone = {
  position: string;
  zone: string;
  element: string;
  direction: Compass | null;
};

export type BaguaResponse = {
  zones: BaguaZone[];
};

export function postBagua(payload: BaguaRequest, token: string): Promise<BaguaResponse> {
  return postJson<BaguaResponse>("/api/feng-shui/bagua", payload, token);
}

export type ChatReplyMessage = { role: "user" | "assistant"; content: string };

export type KnowledgeEntry = {
  system: string;
  category: string;
  topic: string;
  definition: string;
  traditional_interpretation: string;
  modern_interpretation: string;
  psychological_interpretation: string;
  positive_aspects: string;
  challenges: string;
  career_meaning: string;
  relationship_meaning: string;
  growth_meaning: string;
  sources: string[];
  confidence_level: string;
  context_notes: Record<string, string> | null;
};

export type ChatReplyRequest = {
  chart: NatalChart;
  numerology: NumerologyProfile;
  knowledge: KnowledgeEntry[];
  transits?: Transits | null;
  messages: ChatReplyMessage[];
};

export function postChatReply(payload: ChatReplyRequest, token: string): Promise<{ reply: string }> {
  return postJson<{ reply: string }>("/api/chat/reply", payload, token);
}
