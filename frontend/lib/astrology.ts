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
