import { NextRequest, NextResponse } from "next/server";

// Proxies OpenStreetMap's Nominatim search -- free, no API key, no billing
// dependency (deliberately avoided Google Places / Mapbox, which both need
// a paid key, while the project is already blocked on other API costs).
// Routed server-side rather than called directly from the browser because
// Nominatim's usage policy asks for an identifying User-Agent, which
// browser fetch can't set but a server-side fetch can.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = `${NOMINATIM_URL}?format=json&limit=5&accept-language=en&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Aureon (astrology app; contact: georgejermizashvili@gmail.com)" },
  });
  if (!res.ok) {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
  const data = (await res.json()) as NominatimResult[];
  return NextResponse.json({
    results: data.map((r) => ({
      displayName: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    })),
  });
}
