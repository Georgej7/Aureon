const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

/** Mirrors backend/app/calc/astrology.py's longitude_to_sign — kept as a small
 * standalone duplicate rather than a cross-language shared module. */
export function zodiacSign(longitude: number): string {
  const normalized = ((longitude % 360) + 360) % 360;
  const index = Math.floor(normalized / 30) % 12;
  return SIGNS[index];
}

// Structural (which stone per sign), not interpretive — the "why" for each
// lives in the knowledge_base's birthstone entries, not hardcoded here.
const BIRTHSTONES: Record<string, string> = {
  Aries: "Diamond",
  Taurus: "Emerald",
  Gemini: "Agate",
  Cancer: "Pearl",
  Leo: "Peridot",
  Virgo: "Sapphire",
  Libra: "Opal",
  Scorpio: "Topaz",
  Sagittarius: "Turquoise",
  Capricorn: "Garnet",
  Aquarius: "Amethyst",
  Pisces: "Aquamarine",
};

export function birthstoneForSign(sign: string): string | null {
  return BIRTHSTONES[sign] ?? null;
}

export type Element = "Fire" | "Earth" | "Air" | "Water";

const ELEMENT_BY_SIGN: Record<string, Element> = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water",
};

export function elementForSign(sign: string): Element | null {
  return ELEMENT_BY_SIGN[sign] ?? null;
}

/** Standard "dominant element" reading: count the element of each of the 10
 * classical/modern planets' signs (not asteroids/Lilith -- those aren't part
 * of the traditional dominant-element count) and return whichever element
 * has the most. Used to subtly bias the ambient background's palette per
 * user (Starfield.tsx) -- ties visual mood to something astrologically
 * real rather than a random per-session color. */
export function dominantElement(planetSigns: string[]): Element | null {
  const counts: Record<Element, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const sign of planetSigns) {
    const el = elementForSign(sign);
    if (el) counts[el]++;
  }
  let best: Element | null = null;
  let bestCount = 0;
  for (const el of Object.keys(counts) as Element[]) {
    if (counts[el] > bestCount) {
      best = el;
      bestCount = counts[el];
    }
  }
  return best;
}

/** Converts a plain UTC-offset number (e.g. 4, -5.5) into an ISO 8601 offset
 * suffix (e.g. "+04:00", "-05:30") for building a datetime string the
 * backend's BirthData model can parse. */
export function offsetToIso(offsetHours: number): string {
  const sign = offsetHours < 0 ? "-" : "+";
  const abs = Math.abs(offsetHours);
  const hh = String(Math.floor(abs)).padStart(2, "0");
  const mm = String(Math.round((abs - Math.floor(abs)) * 60)).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}
