const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type PlanetPlacement = {
  name: string;
  longitude: number;
  sign: string;
  sign_degree: number;
  house: number;
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
  houses: HouseCusp[];
  ascendant: number;
  midheaven: number;
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
  latitude: number;
  longitude: number;
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
