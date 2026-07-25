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

export type NatalChart = {
  planets: PlanetPlacement[];
  houses: HouseCusp[] | null;
  ascendant: number | null;
  midheaven: number | null;
  aspects: Aspect[];
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

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}`);
  }
  return res.json() as Promise<TResponse>;
}

export function postNatalChart(payload: NatalChartRequest): Promise<NatalChart> {
  return postJson<NatalChart>("/api/chart/natal", payload);
}

export function postNumerology(payload: NumerologyRequest): Promise<NumerologyProfile> {
  return postJson<NumerologyProfile>("/api/numerology", payload);
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
  messages: ChatReplyMessage[];
};

export function postChatReply(payload: ChatReplyRequest): Promise<{ reply: string }> {
  return postJson<{ reply: string }>("/api/chat/reply", payload);
}
