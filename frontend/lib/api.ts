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
};

export type NumerologyProfile = {
  life_path: number;
  expression: number;
  soul_urge: number;
  personality: number;
  personal_year: number;
};

export type NatalChartRequest = {
  datetime: string;
  latitude?: number;
  longitude?: number;
  time_known?: boolean;
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

export function postNatalChart(payload: NatalChartRequest): Promise<NatalChart> {
  return postJson<NatalChart>("/api/chart/natal", payload);
}

export function postNumerology(payload: NumerologyRequest): Promise<NumerologyProfile> {
  return postJson<NumerologyProfile>("/api/numerology", payload);
}

export function postTransits(payload: TransitsRequest): Promise<Transits> {
  return postJson<Transits>("/api/chart/transits", payload);
}

export function postSynastry(payload: SynastryRequest): Promise<Synastry> {
  return postJson<Synastry>("/api/chart/synastry", payload);
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
