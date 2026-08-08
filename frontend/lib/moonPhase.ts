// Standalone synodic-month approximation (no ephemeris/backend call needed)
// -- accurate to within roughly an hour, which is plenty for a display
// figure. Deliberately not routed through the Swiss Ephemeris backend:
// this only needs to be "real," not natal-chart-precise, and it has to
// render instantly for logged-out visitors with zero network dependency.
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

export type MoonPhase = { name: string; illuminationPct: number };

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const daysSince = (date.getTime() - KNOWN_NEW_MOON_UTC) / 86_400_000;
  const age = ((daysSince % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const illuminationPct = Math.round((1 - Math.cos((age / SYNODIC_MONTH_DAYS) * 2 * Math.PI)) * 50);

  let name: string;
  if (age < 1.84566) name = "New Moon";
  else if (age < 5.53699) name = "Waxing Crescent";
  else if (age < 9.22831) name = "First Quarter";
  else if (age < 12.91963) name = "Waxing Gibbous";
  else if (age < 16.61096) name = "Full Moon";
  else if (age < 20.30228) name = "Waning Gibbous";
  else if (age < 23.99361) name = "Last Quarter";
  else if (age < 27.68493) name = "Waning Crescent";
  else name = "New Moon";

  return { name, illuminationPct };
}
