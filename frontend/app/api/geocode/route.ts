import { NextRequest, NextResponse } from "next/server";

// Proxies Komoot's Photon (photon.komoot.io) -- free, no API key, no billing
// dependency (deliberately avoided Google Places / Mapbox, which both need
// a paid key, while the project is already blocked on other API costs).
// Originally used Nominatim directly, but its public instance consistently
// returned 502 for every request specifically from Render's servers (100%
// reproducible, confirmed live -- works fine from a plain terminal, fails
// every time from the deployed app) -- Nominatim's own usage policy
// explicitly says its public instance is for low-volume/non-production use
// and appears to actively block shared-hosting-platform IP ranges. Photon is
// also OSM-based (same underlying map data, comparable result quality) but
// a separate service with its own infrastructure, and hasn't shown the same
// block from Render's IPs in testing.
const PHOTON_URL = "https://photon.komoot.io/api/";

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

function formatDisplayName(props: PhotonFeature["properties"]): string {
  // Country- and state-level results have name === country/state (e.g.
  // searching "Georgia" returns a result named "Georgia" whose country
  // field is also "Georgia") -- appending it again would read as
  // "Georgia, Georgia" instead of just "Georgia".
  const parts = [props.name];
  if (props.city && props.city !== props.name) parts.push(props.city);
  if (props.state && props.state !== props.name) parts.push(props.state);
  if (props.country && props.country !== props.name) parts.push(props.country);
  return parts.filter(Boolean).join(", ");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = `${PHOTON_URL}?limit=5&lang=en&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ results: [] }, { status: 502 });
  }
  const data = (await res.json()) as { features: PhotonFeature[] };
  return NextResponse.json({
    results: (data.features ?? [])
      .filter((f) => f.properties.name) // drop unnamed results (rare, but seen for some minor OSM ways)
      .map((f) => ({
        displayName: formatDisplayName(f.properties),
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
      })),
  });
}
